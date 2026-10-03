import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import extension, { canRename, cleanTitle, openingConversation, request } from "./index.ts";

const user = { type: "message", message: { role: "user", content: "Please improve Pi tab names" } };
const delay = () => new Promise((resolve) => setTimeout(resolve, 5));
async function until(predicate) {
  for (let n = 0; n < 200; n++) { if (predicate()) return; await delay(); }
  assert.fail("Timed out waiting for extension");
}

async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), "pi-title-"));
  const socketPath = join(dir, "herdr.sock");
  const tab = { tab_id: "w1:t1", label: "1", pane_count: 1 };
  const requests = [];
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const input = JSON.parse(buffer.trim());
      requests.push(input);
      let result;
      if (input.method === "pane.get") result = { pane: { pane_id: "w1:p1", tab_id: tab.tab_id } };
      if (input.method === "tab.get") result = { tab };
      if (input.method === "tab.rename") { tab.label = input.params.label; result = { type: "tab_renamed" }; }
      const reply = `${JSON.stringify({ id: input.id, result })}\n`;
      // Exercise fragmented socket framing.
      socket.write(reply.slice(0, 8));
      socket.end(reply.slice(8));
    });
  });
  await new Promise((resolve) => server.listen(socketPath, resolve));
  const previous = { ...process.env };
  Object.assign(process.env, { HERDR_ENV: "1", HERDR_SOCKET_PATH: socketPath, HERDR_PANE_ID: "w1:p1", HERDR_TAB_ID: "wrong-inherited-tab" });
  delete process.env.PI_SUBAGENT_SURFACE;
  const instances = [];
  function start({ entries = [user], name, mode = "tui", generate } = {}) {
    const handlers = new Map();
    let calls = 0;
    let currentName = name;
    const pi = {
      on: (event, handler) => handlers.set(event, handler),
      getSessionName: () => currentName,
      setSessionName: (value) => { currentName = value; handlers.get("session_info_changed")?.({}, ctx); },
      appendEntry: (customType, data) => entries.push({ type: "custom", customType, data }),
    };
    const ctx = {
      mode, model: { id: "current-model" },
      sessionManager: { getEntries: () => entries, getBranch: () => entries },
      modelRegistry: { streamSimple: (model, context, options) => {
        calls++;
        assert.equal(model, ctx.model);
        assert.ok(options.signal);
        return { result: async () => generate ? generate(options.signal) : ({ stopReason: "stop", content: [{ type: "text", text: "Pi Herdr tab titles" }] }) };
      } },
    };
    extension(pi);
    const instance = { handlers, ctx, pi, entries, calls: () => calls, name: () => currentName,
      emit: (event) => handlers.get(event)?.({}, ctx) };
    instances.push(instance);
    instance.emit("session_start");
    return instance;
  }
  try { await run({ tab, requests, start, socketPath }); }
  finally {
    for (const instance of instances) instance.emit("session_shutdown");
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

test("sanitizes bounded titles and conservatively preserves labels", () => {
  assert.equal(cleanTitle('\x1b[31m"Pi\n titles"\x1b[0m'), "Pi titles");
  assert.equal(Array.from(cleanTitle("🦊".repeat(100))).length, 48);
  assert.equal(canRename({ label: "5", pane_count: 1 }), true);
  assert.equal(canRename({ label: "server", pane_count: 1 }), false);
  assert.equal(canRename({ label: "5", pane_count: 2 }), false);
  assert.equal(canRename({ label: "old", pane_count: 1 }, "old"), true);
  assert.equal(canRename({ label: "6", pane_count: 1 }, "old"), false);
  assert.equal(openingConversation([user, { type: "message", message: { role: "toolResult", content: "SECRET" } }]), "user: Please improve Pi tab names");
});

test("names only the containing tab, saves session name, and generates once", async () => fixture(async ({ start, tab, requests }) => {
  const app = start();
  await until(() => app.entries.some((entry) => entry.type === "custom"));
  assert.equal(tab.label, "Pi Herdr tab titles");
  assert.equal(app.name(), tab.label);
  app.emit("agent_settled");
  await delay();
  assert.equal(app.calls(), 1);
  assert.deepEqual(requests.filter((r) => r.method === "tab.rename").map((r) => r.params), [{ tab_id: "w1:t1", label: tab.label }]);
  assert.ok(requests.every((r) => ["pane.get", "tab.get", "tab.rename"].includes(r.method)));
}));

test("empty session waits for first exchange", async () => fixture(async ({ start, tab }) => {
  const entries = [];
  const app = start({ entries });
  await delay(); await delay();
  assert.equal(app.calls(), 0);
  entries.push(user);
  app.emit("agent_settled");
  await until(() => tab.label === "Pi Herdr tab titles");
}));

test("manual names, split tabs, non-TUI runs and subagents are left alone", async () => {
  for (const kind of ["manual", "split", "print", "child"]) await fixture(async ({ start, tab }) => {
    if (kind === "manual") tab.label = "my tab";
    if (kind === "split") tab.pane_count = 2;
    if (kind === "child") process.env.PI_SUBAGENT_SURFACE = "w1:p1";
    const app = start({ mode: kind === "print" ? "print" : "tui" });
    await delay(); await delay();
    assert.equal(app.calls(), 0);
    assert.equal(tab.label, kind === "manual" ? "my tab" : "1");
  });
});

test("a manual Herdr rename during generation wins", async () => fixture(async ({ start, tab, requests }) => {
  let complete;
  const app = start({ generate: () => new Promise((resolve) => { complete = resolve; }) });
  await until(() => complete);
  tab.label = "keep this";
  complete({ stopReason: "stop", content: [{ type: "text", text: "Generated title" }] });
  await until(() => app.name());
  await delay(); await delay();
  assert.equal(tab.label, "keep this");
  assert.equal(requests.filter((r) => r.method === "tab.rename").length, 0);
}));

test("/name during generation wins and /new can replace an owned label", async () => fixture(async ({ start, tab }) => {
  let complete;
  const app = start({ generate: () => new Promise((resolve) => { complete = resolve; }) });
  await until(() => complete);
  app.pi.setSessionName("Manual Pi name");
  complete({ stopReason: "stop", content: [{ type: "text", text: "Generated" }] });
  await until(() => app.entries.some((entry) => entry.type === "custom"));
  assert.equal(tab.label, "Manual Pi name");
  app.emit("session_shutdown");
  const next = start({ name: "New session" });
  await until(() => tab.label === "New session");
  assert.equal(next.calls(), 0);
}));

test("reload reuses title without generation; later manual Herdr rename is preserved", async () => fixture(async ({ start, tab }) => {
  const app = start();
  await until(() => app.entries.some((entry) => entry.type === "custom"));
  app.emit("session_shutdown");
  const next = start({ entries: app.entries, name: app.name() });
  await delay(); await delay();
  assert.equal(next.calls(), 0);
  tab.label = "my override";
  next.pi.setSessionName("Different Pi name");
  await delay(); await delay();
  assert.equal(tab.label, "my override");
}));

test("shutdown cancels generation and prevents late writes", async () => fixture(async ({ start, tab, requests }) => {
  let complete, signal;
  const app = start({ generate: (s) => { signal = s; return new Promise((resolve) => { complete = resolve; }); } });
  await until(() => complete);
  app.emit("session_shutdown");
  assert.equal(signal.aborted, true);
  complete({ stopReason: "stop", content: [{ type: "text", text: "Too late" }] });
  await delay();
  assert.equal(tab.label, "1");
  assert.equal(app.name(), undefined);
  assert.equal(requests.filter((r) => r.method === "tab.rename").length, 0);
}));

test("provider failure is cosmetic and does not repeatedly spend tokens", async () => fixture(async ({ start, tab }) => {
  const app = start({ generate: async () => { throw new Error("offline"); } });
  await until(() => app.calls() === 1);
  await delay();
  app.emit("agent_settled");
  await delay(); await delay();
  assert.equal(tab.label, "1");
  assert.equal(app.calls(), 1);
}));

test("missing Herdr socket rejects cleanly", async () => {
  await assert.rejects(request("/tmp/no-such-herdr-title-test.sock", "tab.get", {}));
});
