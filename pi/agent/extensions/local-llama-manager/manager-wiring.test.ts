// Tests the real manager function bodies with a fully mocked OS/network.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import { ownsProcessGroup, sameExecutable, sameProcess, type ProcessIdentity } from "./process-identity.ts";
import { buildServerArgs } from "../local-llama-manager.ts";
import { createOwnedStream } from "./owned-stream.ts";
import { TestStream, successStream } from "./stream-fixture.ts";

const source = readFileSync(new URL("../local-llama-manager.ts", import.meta.url), "utf8");
function body(start: string, end: string) {
  return stripTypeScriptTypes(source.slice(source.indexOf(start), source.indexOf(end))).replaceAll("export ", "");
}
const startBody = body("async function startServer(", "function desiredServerArgs(");
const ensureBody = body("function desiredServerArgs(", "function latestModelChangeEntry(");
const factoryBody = stripTypeScriptTypes(source.slice(source.indexOf("export default async function localLlamaManager(")))
  .replace("export default ", "")
  .replace('await import("@earendil-works/pi-ai/compat")', "mockAi");
const identity: ProcessIdentity = {
  version: 1, pid: 4242, bootId: "12345678-1234-1234-1234-123456789abc",
  startTime: "123", uid: 1000, processGroup: 4242, session: 4242,
  executable: { path: "/real/llama-server", device: "12", inode: "34" },
};
const config = { llamaServer: "/symlink/llama-server", port: 8080, stateDir: "/mock-state", models: { model: { path: "/mock-model" } } };

function spawnFixture(actual: ProcessIdentity | undefined, spawnError = false, model: Parameters<typeof buildServerArgs>[2] = config.models.model) {
  const writes = new Map<string, string>();
  const closes: number[] = [];
  let spawnSeen = false;
  let waited = false;
  const child = Object.assign(new EventEmitter(), { pid: 4242, unref() {} });
  const context = createContext({
    process: { platform: "linux", env: {}, kill() { assert.fail("No real/raw signaling allowed"); } },
    existsSync: () => true, ensureStateDir: () => {},
    logPath: () => "/mock-log", currentPath: () => "current.json", pidPath: () => "server.pid",
    openSync: () => 123, closeSync: (fd: number) => closes.push(fd),
    writeFileSync: (path: string, value: string) => writes.set(path, value),
    executableIdentity: (path: string) => { assert.equal(path, config.llamaServer); return identity.executable; },
    inspectLinuxProcess: (pid: number) => { assert.equal(pid, 4242); assert.ok(spawnSeen); return actual; },
    ownsProcessGroup, sameExecutable, buildServerArgs,
    spawn: (path: string, args: string[], options: { detached: boolean }) => {
      assert.equal(path, identity.executable.path);
      assert.ok(args.includes("/mock-model")); assert.equal(options.detached, true);
      queueMicrotask(() => { spawnSeen = true; child.emit(spawnError ? "error" : "spawn", new Error("mock exec failure")); });
      return child;
    },
    waitUntilServing: async (_config: unknown, alias: string, savedIdentity: ProcessIdentity) => {
      assert.equal(alias, "model"); assert.equal(savedIdentity, identity); waited = true;
    },
  });
  runInContext(startBody, context);
  return { context, run: (signal?: AbortSignal) => context.startServer(config, "model", model, signal), writes, closes, waited: () => waited };
}

test("manager spawns canonical server path and persists inspected identity before readiness", async () => {
  const f = spawnFixture(identity);
  await f.run();
  const saved = JSON.parse(f.writes.get("current.json")!);
  assert.deepEqual(saved.identity, identity);
  assert.equal(f.writes.get("server.pid"), "4242");
  assert.equal(f.waited(), true);
  assert.deepEqual(f.closes, [123, 123]);
});

for (const actual of [undefined, { ...identity, executable: { ...identity.executable, inode: "999" } }, { ...identity, processGroup: 7777 }]) {
  test("manager refuses to publish or signal unverified spawned PID", async () => {
    const f = spawnFixture(actual);
    await assert.rejects(f.run(), /Cannot verify/);
    assert.equal(f.writes.size, 0); assert.equal(f.waited(), false);
  });
}

test("invalid vision config fails before opening resources or spawning", async () => {
  const f = spawnFixture(identity, false, { path: "/mock-model", input: ["text", "image"] });
  await assert.rejects(f.run(), /requires an mmproj path/);
  assert.equal(f.writes.size, 0);
  assert.deepEqual(f.closes, []);
  assert.equal(f.waited(), false);
});

test("exec/spawn failure is surfaced without publishing a PID", async () => {
  const f = spawnFixture(identity, true);
  await assert.rejects(f.run(), /mock exec failure/);
  assert.equal(f.writes.size, 0);
});

for (const stillOwned of [true, false]) {
  for (const failure of ["cancelled", "failed"]) {
    test(`${failure} startup only shuts down its verified spawned process (owned=${stillOwned})`, async () => {
      const f = spawnFixture(identity);
      const controller = new AbortController();
      let stopped = false;
      f.context.sameProcess = sameProcess;
      f.context.getManagedCurrent = () => ({ identity: stillOwned ? identity : { ...identity, startTime: "999" } });
      f.context.stopManagedServer = async () => { stopped = true; };
      f.context.waitUntilServing = async (_config: unknown, _alias: string, _identity: unknown, signal: AbortSignal) => {
        assert.equal(signal, controller.signal);
        if (failure === "cancelled") { controller.abort(); signal.throwIfAborted(); }
        throw new Error("startup timeout");
      };
      await assert.rejects(f.run(controller.signal), failure === "cancelled" ? /aborted/ : /startup timeout/);
      assert.equal(stopped, stillOwned);
    });
  }
}

function reuseFixture(current: any, served?: string) {
  const calls: string[] = [];
  const context = createContext({
    buildServerArgs,
    getManagedCurrent: () => current,
    stopManagedServer: async () => { calls.push("stop"); current = undefined; return true; },
    getServedModel: async () => { calls.push("network"); return served; },
    startServer: async () => { calls.push("start"); },
  });
  runInContext(ensureBody, context);
  return { context, calls };
}
function owned(args: any = buildServerArgs(config, "model", config.models.model), alias = "model") {
  return { alias, pid: 4242, identity, args };
}

for (const alias of ["model", "external-model"]) {
  for (const operation of ["ensureModelRunning", "restartModel"]) {
    test(`${operation} rejects external ${alias} without stopping or starting it`, async () => {
      const f = reuseFixture(undefined, alias);
      await assert.rejects(f.context[operation](config, "model"), /not started by this extension/);
      assert.deepEqual(f.calls, ["network"]);
    });
  }
}

test("verified same config preserves fast path without any network or stop", async () => {
  const f = reuseFixture(owned(), "model");
  assert.equal(await f.context.ensureModelRunning(config, "model"), "already-running");
  f.context.assertRequestServer(config, "model");
  assert.deepEqual(f.calls, []);
});

for (const saved of [undefined, null, "--model", {}, [], [1], [null]]) {
  test(`missing/malformed saved args (${JSON.stringify(saved)}) require restart, with no /models bypass`, async () => {
    const f = reuseFixture({ ...owned(), args: saved }, "model");
    await assert.rejects(f.context.ensureModelRunning(config, "model"), /Restart required: \/local-llm restart model/);
    assert.throws(() => f.context.assertRequestServer(config, "model"), /Restart required/);
    assert.deepEqual(f.calls, []);
  });
}

test("non-string saved argument cannot compare as compatible", async () => {
  const args: any[] = buildServerArgs(config, "model", config.models.model);
  args[1] = { toString: () => "/mock-model" };
  const f = reuseFixture(owned(args));
  await assert.rejects(f.context.ensureModelRunning(config, "model"), /Restart required/);
  assert.deepEqual(f.calls, []);
});

test("same-alias changes all require explicit restart without network or shutdown", async t => {
  const dir = mkdtempSync(join(tmpdir(), "reuse-projector-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const projector = join(dir, "projector.gguf");
  const otherProjector = join(dir, "other.gguf");
  writeFileSync(projector, "GGUFfixture");
  writeFileSync(otherProjector, "GGUFfixture");
  const text = config.models.model;
  const vision = { ...text, input: ["text", "image"] as ("text" | "image")[], mmproj: projector };
  const changes = [
    ["text to vision", config, vision],
    ["projector changed", { ...config, models: { model: vision } }, { ...vision, mmproj: otherProjector }],
    ["projector and vision removed", { ...config, models: { model: vision } }, text],
    ["main model path", config, { ...text, path: "/different-model" }],
    ["model args", config, { ...text, args: ["--ctx-size", "8192"] }],
    ["common args removed", { ...config, commonArgs: ["--jinja"] }, text],
    ["model args removed", { ...config, models: { model: { ...text, args: ["--jinja"] } } }, text],
  ] as const;
  for (const [name, previous, model] of changes) {
    await t.test(name, async () => {
      const f = reuseFixture(owned(buildServerArgs(previous, "model", previous.models.model)), "model");
      const desired = { ...config, models: { model } };
      await assert.rejects(f.context.ensureModelRunning(desired, "model"), /Restart required/);
      assert.throws(() => f.context.assertRequestServer(desired, "model"), /Restart required/);
      assert.deepEqual(f.calls, []);
    });
  }
});

for (const operation of ["ensureModelRunning", "restartModel"]) {
  test(`${operation} validates invalid vision/unknown alias before network or stop`, async () => {
    const f = reuseFixture(owned(undefined, "old-model"));
    const invalid = { ...config, models: { model: { path: "/mock-model", input: ["text", "image"] } } };
    await assert.rejects(f.context[operation](invalid, "model"), /requires an mmproj path/);
    await assert.rejects(f.context[operation](config, "missing"), /No local model config/);
    assert.deepEqual(f.calls, []);
  });
}

test("explicit restart stops verified stale same-alias server and starts requested config", async () => {
  const f = reuseFixture(owned(["old-config"]));
  await f.context.restartModel(config, "model");
  assert.deepEqual(f.calls, ["stop", "network", "stop", "start"]);
});

test("different-alias owned switch cannot reuse /models alias-only fallback", async () => {
  const f = reuseFixture(owned(undefined, "old-model"), "model");
  assert.equal(await f.context.ensureModelRunning(config, "model"), "started");
  assert.deepEqual(f.calls, ["network", "stop", "start"]);
});

async function factoryFixture(current: any, busy = false) {
  const f = reuseFixture(current);
  let latest: any = { ...config, provider: "local", baseUrl: "http://localhost:8080/v1" };
  let stream: any;
  const handlers = new Map<string, any>();
  const commands = new Map<string, any>();
  const statuses: string[] = [];
  const notifications: string[] = [];
  let lockAttempts = 0;
  const ctx = {
    model: { provider: "local", id: "model" },
    ui: { setStatus: (_key: string, text: string) => statuses.push(text), notify: (text: string) => notifications.push(text) },
    sessionManager: { getBranch: () => [] },
  };
  Object.assign(f.context, {
    mockAi: { openAICompletionsApi: () => ({ streamSimple: () => { f.calls.push("request"); return successStream(); } }), createAssistantMessageEventStream: () => new TestStream() },
    createOwnedStream, idleShutdownDelay: () => undefined,
    loadConfig: () => latest, ensureStateDir: () => {},
    registerLocalProvider: (_pi: unknown, _config: unknown, delegate: any) => { stream = delegate; },
    acquireServerLock: async () => { lockAttempts++; return busy ? undefined : () => f.calls.push("release"); },
    readLock: () => ({ phase: "turn", model: "model", pid: 42 }),
    describeLock: () => "other instance", logPath: () => "/mock-log",
    latestModelChangeEntry: () => undefined, runtimeSummary: async () => "model=model",
    removeLockIfStale: () => {}, setInterval: () => ({ unref() {} }), clearInterval: () => {},
    STOP_SHORTCUT: "ctrl+shift+x",
  });
  runInContext(factoryBody, f.context);
  await f.context.localLlamaManager({
    on: (name: string, handler: any) => handlers.set(name, handler),
    registerShortcut: () => {}, registerCommand: (name: string, command: any) => commands.set(name, command.handler),
  });
  return { ...f, ctx, handlers, commands, statuses, notifications, stream: () => stream({ ...ctx.model, baseUrl: latest.baseUrl }, {}, {}),
    setConfig: (value: any) => { latest = value; }, lockAttempts: () => lockAttempts };
}

test("busy stale selection rejects before lock attempt and never reports loaded", async () => {
  const f = await factoryFixture(owned(["old-config"]), true);
  f.handlers.get("model_select")({ model: f.ctx.model }, f.ctx);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.lockAttempts(), 0);
  assert.ok(f.notifications.some(text => text.includes("Restart required")));
  assert.ok(!f.statuses.some(text => /loaded|ready|running/.test(text)));
  assert.deepEqual(f.calls, []);
  await f.handlers.get("session_start")({}, f.ctx);
  assert.match(f.statuses.at(-1)!, /restart required/);
});

test("busy matching selection can report already loaded without any network/stop", async () => {
  const f = await factoryFixture(owned(), true);
  f.handlers.get("model_select")({ model: f.ctx.model }, f.ctx);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.lockAttempts(), 1);
  assert.ok(f.statuses.some(text => text.includes("already loaded, busy")));
  assert.deepEqual(f.calls, []);
});

test("stream guard independently rejects stale config and loadConfig failures before delegate", async () => {
  const f = await factoryFixture(owned(["old-config"]));
  assert.match((await f.stream().result()).errorMessage, /Restart required/);
  f.context.loadConfig = () => { throw new Error("Invalid mmproj"); };
  assert.match((await f.stream().result()).errorMessage, /Invalid mmproj/);
  assert.deepEqual(f.calls, []);
});

test("restart command surfaces external refusal instead of reporting Restarted", async () => {
  const f = await factoryFixture(undefined);
  f.context.getServedModel = async () => "model";
  await assert.rejects(f.commands.get("local-llm")("restart model", f.ctx), /cannot restart an external server/);
  assert.ok(!f.notifications.some(text => text.includes("Restarted")));
  assert.deepEqual(f.calls, ["release"]);
});

test("an eager same-alias load with old config cannot authorize a new request", async () => {
  const f = await factoryFixture(undefined);
  let current: any;
  f.context.getManagedCurrent = () => current;
  const realEnsure = f.context.ensureModelRunning;
  let finishLoad!: () => void;
  const pending = new Promise<void>(resolve => { finishLoad = resolve; });
  let first = true;
  f.context.ensureModelRunning = async (latest: any, alias: string) => {
    if (!first) return realEnsure(latest, alias);
    first = false;
    await pending;
    current = owned();
    return "started";
  };
  f.handlers.get("model_select")({ model: f.ctx.model }, f.ctx);
  await new Promise(resolve => setImmediate(resolve));
  f.setConfig({ ...config, provider: "local", baseUrl: "http://localhost:8080/v1", commonArgs: ["--jinja"] });
  finishLoad();
  await new Promise(resolve => setImmediate(resolve));
  const request = f.stream();
  assert.match((await request.result()).errorMessage, /Restart required/);
  assert.match((await f.stream().result()).errorMessage, /Restart required/);
  assert.ok(!f.calls.includes("stop") && !f.calls.includes("request"));
});

test("previously scheduled idle shutdown leaves a now-stale server untouched", async () => {
  const f = await factoryFixture(owned());
  let timer!: () => void;
  f.context.idleShutdownDelay = () => 1000;
  f.context.setTimeout = (callback: () => void) => { timer = callback; return { unref() {} }; };
  f.context.clearTimeout = () => {};
  await f.stream().result();
  assert.equal(typeof timer, "function");
  f.setConfig({ ...config, provider: "local", baseUrl: "http://localhost:8080/v1", commonArgs: ["--jinja"] });
  timer();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.lockAttempts(), 1);
  assert.deepEqual(f.calls, ["request", "release"]);
});

test("startup failure releases request lock and reports a terminal error", async () => {
  const f = await factoryFixture(undefined);
  f.context.getServedModel = async () => "model";
  assert.match((await f.stream().result()).errorMessage, /not started by this extension/);
  assert.deepEqual(f.calls, ["release"]);
  assert.match((await f.stream().result()).errorMessage, /not started by this extension/);
  assert.deepEqual(f.calls, ["release", "release"]);
});
