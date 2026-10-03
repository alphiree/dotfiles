// Real manager/provider/lock wiring; only transport, server OS operations and
// timers are fake. No live model/server, sleeps, or timeout grace periods.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { createContext, runInContext } from "node:vm";
import { test } from "node:test";
import { createOwnedStream } from "./owned-stream.ts";
import { TestStream, successStream } from "./stream-fixture.ts";
import { buildServerArgs } from "../local-llama-manager.ts";

const source = readFileSync(new URL("../local-llama-manager.ts", import.meta.url), "utf8");
function body(start: string, end?: string) {
  return stripTypeScriptTypes(source.slice(source.indexOf(start), end ? source.indexOf(end) : undefined))
    .replace("export default ", "").replaceAll("export ", "").replace('await import("@earendil-works/pi-ai/compat")', "mockAi");
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

async function fixture(t: any) {
  const dir = mkdtempSync(join(tmpdir(), "llama-lifecycle-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = { provider: "local", baseUrl: "http://fake/v1", port: 8080, llamaServer: "/fake",
    stateDir: dir, idleShutdownMs: 1, stopOnSessionShutdown: true,
    models: { a: { path: "/a.gguf" }, b: { path: "/b.gguf" } } };
  let current: any;
  const calls: string[] = [];
  const polls: Array<() => void> = [];
  const timers = new Map<object, () => void>();
  let transport: any = () => successStream();
  const successfulStartup = async (alias: string) => {
    current = { alias, args: buildServerArgs(config, alias, config.models[alias as "a"]) };
  };
  let startup: any = successfulStartup;
  const ctx = { model: { id: "a", provider: "local" }, ui: { setStatus() {}, notify() {} },
    sessionManager: { getBranch: () => [], getSessionFile: () => "/fake/session" }, isIdle: () => false, abort() {} };
  const instances: any[] = [];
  async function instance() {
    let provider: any;
    let shortcut: any;
    const handlers = new Map<string, any>();
    const commands = new Map<string, any>();
    const context = createContext({
      readFileSync, writeFileSync, unlinkSync, join, basename, createOwnedStream, buildServerArgs,
      process: { pid: process.pid, cwd: () => dir, kill(pid: number, signal: number) { assert.equal(pid, process.pid); assert.equal(signal, 0); } },
      ensureStateDir: () => mkdirSync(dir, { recursive: true }),
      getVerifiedCurrent: () => current, loadConfig: () => config,
      LOCK_POLL_MS: 750, LOCK_HEARTBEAT_MS: 2000, LOCK_STALE_MS: 6 * 60 * 60 * 1000,
      delay: (_ms: number, _value: unknown, { signal }: { signal?: AbortSignal }) => new Promise<void>((resolve, reject) => {
        const abort = () => { polls.splice(polls.indexOf(wake), 1); reject(signal!.reason); };
        const wake = () => { signal?.removeEventListener("abort", abort); resolve(); };
        polls.push(wake); signal?.addEventListener("abort", abort, { once: true });
      }),
      setInterval: () => ({ unref() {} }), clearInterval() {},
      setTimeout: (fn: () => void) => { const id = { unref() {} }; timers.set(id, fn); return id; },
      clearTimeout: (id: object) => timers.delete(id),
      getServedModel: async () => undefined,
      stopManagedServer: async () => { assert.ok(existsSync(join(dir, "server-use.lock"))); calls.push("stop"); current = undefined; return true; },
      startServer: async (_config: any, alias: string) => { calls.push(`load:${alias}`); await startup(alias); },
      runtimeSummary: async () => "mock", logPath: () => "/fake/log", STOP_SHORTCUT: "ctrl+shift+x",
      registerLocalProvider: (_pi: any, _config: any, stream: any) => { provider = stream; },
      mockAi: { openAICompletionsApi: () => ({ streamSimple: (...args: any[]) => {
        assert.ok(existsSync(join(dir, "server-use.lock")), "dispatch requires durable ownership");
        calls.push(`request:${args[0].id}`); return transport(...args);
      } }), createAssistantMessageEventStream: () => new TestStream() },
    });
    runInContext(body("function lockPath(", "async function getServedModelInfo("), context);
    runInContext(body("function idleShutdownDelay(", "async function stopManagedServer("), context);
    runInContext(body("function desiredServerArgs(", "export function registerLocalProvider("), context);
    runInContext(body("export default async function localLlamaManager("), context);
    await context.localLlamaManager({ on: (event: string, handler: any) => handlers.set(event, handler),
      registerCommand: (name: string, command: any) => commands.set(name, command.handler),
      registerShortcut: (_name: string, options: any) => { shortcut = options.handler; } });
    const request = (alias = "a", signal?: AbortSignal) => provider({ id: alias, provider: "local", baseUrl: config.baseUrl, api: "openai-completions" }, { messages: [] }, { signal });
    const emit = async (event: string) => { await handlers.get(event)?.({}, ctx); };
    const value = { context, request, emit, shortcut: () => shortcut(ctx), command: (command: string) => commands.get("local-llm")(command, ctx), handlers };
    instances.push(value); return value;
  }
  return { config, calls, ctx, instance, lock: () => existsSync(join(dir, "server-use.lock")),
    current: () => current, publish: successfulStartup, clearServer: () => { current = undefined; },
    setTransport: (fn: any) => { transport = fn; }, setStartup: (fn: any) => { startup = fn; }, resetStartup: () => { startup = successfulStartup; },
    wake: async () => { polls.splice(0).forEach(wake => wake()); await flush(); },
    idle: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await flush(); },
    timers, polls };
}

test("idle provider dispatch owns server-use.lock without before_agent_start", async t => {
  const f = await fixture(t); const pi = await f.instance();
  await f.publish("a");
  assert.equal((await pi.request().result()).stopReason, "stop");
  assert.equal(f.lock(), false);
});

for (const route of ["automatic compaction", "manual compaction", "branch summarization", "direct summarization"]) {
  test(`agent_end then ${route} owns dispatch after idle stop and prevents idle interruption`, async t => {
    const f = await fixture(t); const pi = await f.instance();
    assert.equal(pi.handlers.has("before_agent_start"), false, "obsolete turn lock removed");
    await pi.request().result();
    await pi.emit("agent_end");
    await f.idle(); // Deterministically expire the 1ms idle policy before summary.
    assert.equal(f.current(), undefined);
    const inner = new TestStream(); f.setTransport(() => inner);
    const summary = pi.request(); await flush();
    assert.equal(f.lock(), true); assert.equal(f.current().alias, "a");
    await f.idle(); assert.equal(f.current().alias, "a");
    await pi.emit("agent_end"); await pi.emit("agent_settled");
    await pi.emit("session_shutdown"); assert.equal(f.lock(), true);
    inner.push({ type: "done", reason: "stop", message: { stopReason: "stop", content: [{ type: "text", text: "summary" }] } }); inner.end();
    assert.equal((await summary.result()).content[0].text, "summary");
    assert.equal(f.lock(), false); assert.equal(f.timers.size, 0, "shutdown cannot rearm idle timer");
  });
}

test("active inference blocks idle, stop/restart, same-session model selection and a competing manager", async t => {
  const f = await fixture(t); const pi = await f.instance(); const contender = await f.instance();
  const inner = new TestStream(); f.setTransport(() => inner);
  const request = pi.request(); await flush();
  await f.idle();
  pi.handlers.get("model_select")({ model: { provider: "local", id: "b" } }, f.ctx);
  await flush(); assert.equal(f.current().alias, "a");
  const stop = pi.command("stop"); const restart = contender.command("restart b");
  const waiting = contender.request("b"); await flush();
  assert.equal(f.current().alias, "a"); assert.equal(f.calls.filter(x => x === "stop").length, 1); // initial load only
  inner.push({ type: "done", reason: "stop", message: { stopReason: "stop" } }); inner.end();
  await request.result();
  f.setTransport(() => successStream());
  await f.wake(); await f.wake(); await f.wake();
  await stop; await restart; assert.equal((await waiting.result()).stopReason, "stop");
  assert.equal(f.lock(), false); assert.equal(f.current().alias, "b");
});

test("overflow compact-and-retry reacquires and reloads across stopped/switched servers", async t => {
  const f = await fixture(t); const pi = await f.instance(); const contender = await f.instance();
  f.setTransport(() => { const s = new TestStream(); s.push({ type: "error", reason: "error", error: { stopReason: "error", errorMessage: "context_length_exceeded" } }); s.end(); return s; });
  assert.match((await pi.request().result()).errorMessage, /context_length_exceeded/);
  await pi.emit("agent_end"); await f.idle();
  f.setTransport(() => successStream());
  assert.equal((await pi.request().result()).stopReason, "stop"); // compaction
  await contender.request("b").result(); // switch before retry (no before_agent_start)
  assert.equal((await pi.request().result()).stopReason, "stop");
  assert.equal(f.current().alias, "a"); assert.equal(f.lock(), false);
  assert.deepEqual(f.calls.filter(x => x.startsWith("request:")), ["request:a", "request:a", "request:b", "request:a"]);
});

test("waiting abort removes waiter without dispatch/release of active owner's lock", async t => {
  const f = await fixture(t); const pi = await f.instance(); const contender = await f.instance();
  const inner = new TestStream(); f.setTransport(() => inner);
  const active = pi.request(); await flush();
  const abort = new AbortController(); const waiting = contender.request("b", abort.signal); await flush();
  assert.equal(f.polls.length, 1); abort.abort();
  assert.equal((await waiting.result()).stopReason, "aborted"); assert.equal(f.polls.length, 0);
  assert.equal(f.lock(), true); assert.equal(f.current().alias, "a");
  inner.push({ type: "done", reason: "stop", message: { stopReason: "stop" } }); inner.end(); await active.result();
  f.setTransport(() => successStream()); await contender.request("b").result(); assert.equal(f.lock(), false);
});

test("configuration is re-read after cancellation-aware lock waiting", async t => {
  const f = await fixture(t); const pi = await f.instance(); const contender = await f.instance();
  const inner = new TestStream(); f.setTransport(() => inner);
  const active = pi.request(); await flush();
  const waiting = contender.request(); await flush();
  (f.config as any).commonArgs = ["--jinja"];
  inner.push({ type: "done", reason: "stop", message: { stopReason: "stop" } }); inner.end(); await active.result();
  await f.wake();
  assert.match((await waiting.result()).errorMessage, /Restart required/);
  assert.equal(f.calls.filter(call => call.startsWith("request:")).length, 1);
  assert.equal(f.lock(), false);
});

test("abort during setup holds ownership until setup settles and prevents dispatch", async t => {
  const f = await fixture(t); const pi = await f.instance();
  let finish!: () => void;
  f.setStartup(() => new Promise<void>(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const request = pi.request("a", controller.signal); await flush();
  controller.abort(); await flush(); assert.equal(f.lock(), true);
  finish(); assert.equal((await request.result()).stopReason, "aborted");
  assert.equal(f.lock(), false); assert.ok(!f.calls.some(call => call.startsWith("request:")));
  f.resetStartup(); await pi.request().result(); assert.equal(f.lock(), false);
});

test("owned stream preserves model, context, options and provider terminal message", async () => {
  const model: any = { id: "model", api: "openai-completions", provider: "local" };
  const context: any = { messages: [] };
  const options: any = { reasoning: "off", maxTokens: 123, temperature: 0.7 };
  let released = false;
  const message = { stopReason: "stop", content: [{ type: "text", text: "unchanged" }] };
  const stream = createOwnedStream((actualModel, actualContext, actualOptions) => {
    assert.equal(actualModel, model); assert.equal(actualContext, context); assert.equal(actualOptions, options);
    const inner = new TestStream();
    inner.push({ type: "done", reason: "stop", message }); inner.end(); return inner as any;
  }, () => new TestStream() as any, async () => () => { released = true; });
  assert.equal(await stream(model, context, options).result(), message);
  assert.equal(released, true);
});

test("streaming abort and stop hotkey retain ownership until transport genuinely settles", async t => {
  const f = await fixture(t); const pi = await f.instance(); const contender = await f.instance();
  const inner = new TestStream(); const abort = new AbortController(); f.ctx.abort = () => abort.abort(); f.setTransport(() => inner);
  const active = pi.request("a", abort.signal); await flush(); await pi.shortcut();
  assert.equal(abort.signal.aborted, true); assert.equal(f.lock(), true); assert.equal(f.current().alias, "a");
  const waiting = contender.request("b"); await flush(); assert.equal(f.current().alias, "a");
  inner.push({ type: "error", reason: "aborted", error: { stopReason: "aborted" } }); inner.end();
  assert.equal((await active.result()).stopReason, "aborted");
  f.setTransport(() => successStream()); await f.wake(); await waiting.result(); assert.equal(f.lock(), false);
});

for (const failure of ["setup", "sync dispatch", "async stream", "missing terminal", "abort before dispatch"]) {
  test(`${failure} produces terminal failure and subsequent reacquisition without deadlock`, async t => {
    const f = await fixture(t); const pi = await f.instance();
    let signal: AbortSignal | undefined;
    if (failure === "setup") f.setStartup(async () => { throw new Error("startup failed"); });
    else if (failure === "sync dispatch") f.setTransport(() => { throw new Error("dispatch failed"); });
    else if (failure === "async stream") f.setTransport(() => ({ async *[Symbol.asyncIterator]() { await Promise.resolve(); throw new Error("stream failed"); } }));
    else if (failure === "missing terminal") f.setTransport(() => ({ async *[Symbol.asyncIterator]() {} }));
    else { const controller = new AbortController(); controller.abort(); signal = controller.signal; }
    const failed = await pi.request("a", signal).result();
    assert.equal(failed.stopReason, signal ? "aborted" : "error"); assert.equal(f.lock(), false);
    f.clearServer(); f.resetStartup(); f.setTransport(() => successStream());
    assert.equal((await pi.request().result()).stopReason, "stop");
    assert.equal(f.lock(), false);
  });
}
