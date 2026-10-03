// Tests the real manager function bodies with a fully mocked OS/network.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import { ownsProcessGroup, sameExecutable, type ProcessIdentity } from "./process-identity.ts";
import { buildServerArgs } from "../local-llama-manager.ts";

const source = readFileSync(new URL("../local-llama-manager.ts", import.meta.url), "utf8");
function body(start: string, end: string) {
  return stripTypeScriptTypes(source.slice(source.indexOf(start), source.indexOf(end)));
}
const startBody = body("async function startServer(", "async function ensureModelRunning(");
const ensureBody = body("async function ensureModelRunning(", "function latestModelChangeEntry(");
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
  return { run: () => context.startServer(config, "model", model), writes, closes, waited: () => waited };
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

test("legacy/reused state cannot authorize replacing an external served model", async () => {
  let discarded = 0;
  const context = createContext({
    getManagedCurrent: () => undefined,
    stopManagedServer: async () => { discarded++; return false; },
    getServedModel: async () => "external-model",
    startServer: () => assert.fail("must not spawn over an unknown live server"),
  });
  runInContext(ensureBody, context);
  await assert.rejects(context.ensureModelRunning(config, "model"), /not started by this extension/);
  assert.equal(discarded, 1);
});

test("legacy state is discarded even when external server already serves requested alias", async () => {
  let discarded = 0;
  const context = createContext({
    getManagedCurrent: () => undefined,
    stopManagedServer: async () => { discarded++; return false; },
    getServedModel: async () => "model",
    startServer: () => assert.fail("must not start or stop external server"),
  });
  runInContext(ensureBody, context);
  assert.equal(await context.ensureModelRunning(config, "model"), "already-running");
  assert.equal(discarded, 1);
});

test("verified same model preserves fast path without any network or stop", async () => {
  const context = createContext({
    getManagedCurrent: () => ({ alias: "model", pid: 4242, identity }),
    stopManagedServer: () => assert.fail("must not stop"),
    getServedModel: () => assert.fail("must not require network"),
    startServer: () => assert.fail("must not start"),
  });
  runInContext(ensureBody, context);
  assert.equal(await context.ensureModelRunning(config, "model"), "already-running");
});
