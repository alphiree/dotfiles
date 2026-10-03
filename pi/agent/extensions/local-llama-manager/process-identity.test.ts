// Offline: node --test pi/agent/extensions/local-llama-manager/process-identity.test.ts
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, rmSync, symlinkSync, realpathSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  executableIdentity, getVerifiedCurrent, inspectLinuxProcess, ownsProcessGroup,
  parseProcStat, sameExecutable, sameProcess, stopVerifiedServer,
  type ProcessIdentity, type ProcessRuntime,
} from "./process-identity.ts";

const identity: ProcessIdentity = {
  version: 1, pid: 4242, bootId: "12345678-1234-1234-1234-123456789abc",
  startTime: "12345678901234567890", uid: 1000, processGroup: 4242, session: 4242,
  executable: { path: "/opt/llama-server", device: "123", inode: "456" },
};

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "llama-identity-test-"));
  let observed: ProcessIdentity | undefined = structuredClone(identity);
  let time = 0;
  let inspections = 0;
  const signals: [number, string][] = [];
  const runtime: ProcessRuntime = {
    inspect: (pid) => { assert.equal(pid, identity.pid); inspections++; return observed; },
    signal: (target, kind) => { signals.push([target, kind]); },
    now: () => time,
    sleep: async (ms) => { time += ms; },
  };
  const save = (id: unknown = identity, pid: unknown = identity.pid) => {
    writeFileSync(join(dir, "server.pid"), String(pid));
    writeFileSync(join(dir, "current.json"), JSON.stringify({ alias: "model-a", pid, identity: id }));
  };
  save();
  return {
    dir, runtime, signals, save,
    observe: (id: ProcessIdentity | undefined) => { observed = id; },
    inspections: () => inspections,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

for (const [name, patch] of [
  ["PID reuse, same executable", { startTime: "987" }],
  ["previous boot", { bootId: "aaaaaaaa-1234-1234-1234-123456789abc" }],
  ["changed executable path", { executable: { ...identity.executable, path: "/opt/unrelated" } }],
  ["replaced executable inode", { executable: { ...identity.executable, inode: "789" } }],
  ["changed executable device", { executable: { ...identity.executable, device: "789" } }],
  ["changed UID", { uid: 2000 }],
  ["changed process group", { processGroup: 7777 }],
  ["changed session", { session: 7777 }],
] as const) {
  test(`rejects ${name} for current state and stop without signals`, async () => {
    const f = fixture();
    try {
      f.observe({ ...identity, ...patch });
      assert.equal(getVerifiedCurrent(f.dir, f.runtime), undefined);
      assert.equal(await stopVerifiedServer(f.dir, 0, f.runtime), false);
      assert.deepEqual(f.signals, []);
      assert.equal(existsSync(join(f.dir, "server.pid")), false);
      assert.equal(existsSync(join(f.dir, "current.json")), false);
    } finally { f.cleanup(); }
  });
}

for (const [name, modify] of [
  ["legacy PID only", (f: ReturnType<typeof fixture>) => unlinkSync(join(f.dir, "current.json"))],
  ["legacy current missing identity", (f: ReturnType<typeof fixture>) => f.save(null)],
  ["malformed identity", (f: ReturnType<typeof fixture>) => f.save({ ...identity, startTime: 123 })],
  ["inconsistent saved PID", (f: ReturnType<typeof fixture>) => writeFileSync(join(f.dir, "server.pid"), "7777")],
  ["missing PID file", (f: ReturnType<typeof fixture>) => unlinkSync(join(f.dir, "server.pid"))],
  ["malformed JSON", (f: ReturnType<typeof fixture>) => writeFileSync(join(f.dir, "current.json"), "{")],
  ["process exited or inaccessible", (f: ReturnType<typeof fixture>) => f.observe(undefined)],
  ["inspection throws permission error", (f: ReturnType<typeof fixture>) => { f.runtime.inspect = () => { throw new Error("EACCES"); }; }],
] as const) {
  test(`fails closed: ${name}`, async () => {
    const f = fixture();
    try {
      modify(f);
      assert.equal(getVerifiedCurrent(f.dir, f.runtime), undefined);
      assert.equal(await stopVerifiedServer(f.dir, 0, f.runtime), false);
      assert.deepEqual(f.signals, []);
    } finally { f.cleanup(); }
  });
}

test("matching server is trusted and receives TERM then freshly checked KILL", async () => {
  const f = fixture();
  try {
    assert.equal(getVerifiedCurrent(f.dir, f.runtime)?.alias, "model-a");
    assert.equal(await stopVerifiedServer(f.dir, 300, f.runtime), true);
    assert.deepEqual(f.signals, [[-4242, "SIGTERM"], [-4242, "SIGKILL"]]);
    assert.ok(f.inspections() >= 5);
  } finally { f.cleanup(); }
});

test("matching process in an unowned group/session never receives a group signal", async () => {
  const f = fixture();
  try {
    const otherGroup = { ...identity, processGroup: 7777, session: 7777 };
    f.save(otherGroup); f.observe(otherGroup);
    assert.equal(ownsProcessGroup(otherGroup), false);
    assert.equal(await stopVerifiedServer(f.dir, 0, f.runtime), false);
    assert.deepEqual(f.signals, []);
  } finally { f.cleanup(); }
});

test("identity change between first authorization and TERM suppresses TERM", async () => {
  const f = fixture();
  try {
    let calls = 0;
    f.runtime.inspect = () => ++calls === 1 ? identity : { ...identity, startTime: "987" };
    assert.equal(await stopVerifiedServer(f.dir, 0, f.runtime), false);
    assert.deepEqual(f.signals, []);
  } finally { f.cleanup(); }
});

for (const changed of [undefined, { ...identity, startTime: "987" }, { ...identity, executable: { ...identity.executable, inode: "987" } }]) {
  test(`no escalation after ${changed ? "identity changes" : "leader exits"} during shutdown wait`, async () => {
    const f = fixture();
    try {
      f.runtime.sleep = async () => { f.observe(changed); };
      assert.equal(await stopVerifiedServer(f.dir, 300, f.runtime), true);
      assert.deepEqual(f.signals, [[-4242, "SIGTERM"]]);
    } finally { f.cleanup(); }
  });
}

test("zero-timeout escalation still rechecks identity after TERM", async () => {
  const f = fixture();
  try {
    f.runtime.signal = (target, kind) => {
      f.signals.push([target, kind]);
      f.observe({ ...identity, startTime: "987" });
    };
    await stopVerifiedServer(f.dir, 0, f.runtime);
    assert.deepEqual(f.signals, [[-4242, "SIGTERM"]]);
  } finally { f.cleanup(); }
});

test("supervisor publishes replacement state while waiting: no escalation or deletion", async () => {
  const f = fixture();
  try {
    f.runtime.sleep = async () => { f.save({ ...identity, startTime: "987" }); };
    await stopVerifiedServer(f.dir, 300, f.runtime);
    assert.deepEqual(f.signals, [[-4242, "SIGTERM"]]);
    assert.equal(existsSync(join(f.dir, "server.pid")), true);
    assert.equal(existsSync(join(f.dir, "current.json")), true);
  } finally { f.cleanup(); }
});

test("failed group signal has no unverified PID fallback", async () => {
  const f = fixture();
  try {
    f.runtime.signal = (target, kind) => { f.signals.push([target, kind]); throw new Error("EPERM"); };
    await assert.rejects(stopVerifiedServer(f.dir, 0, f.runtime), /EPERM/);
    assert.deepEqual(f.signals, [[-4242, "SIGTERM"]]);
    assert.equal(existsSync(join(f.dir, "current.json")), true);
  } finally { f.cleanup(); }
});

test("proc stat parser handles spaces/parentheses and start-time precision", () => {
  const fields = Array(20).fill("0");
  fields[0] = "S"; fields[2] = "4242"; fields[3] = "4242"; fields[19] = identity.startTime;
  const raw = `4242 (server (name) with spaces)) ${fields.join(" ")}`;
  assert.deepEqual(parseProcStat(raw, 4242), { processGroup: 4242, session: 4242, startTime: identity.startTime });
  assert.equal(parseProcStat(raw, 7777), undefined);
  fields[0] = "Z";
  assert.equal(parseProcStat(`4242 (zombie) ${fields.join(" ")}`, 4242), undefined);
});

test("spawn executable identity resolves symlink to real path and inode", () => {
  const f = fixture();
  try {
    const target = join(f.dir, "actual-server"); const alias = join(f.dir, "server-symlink");
    writeFileSync(target, "offline fixture, never executed"); symlinkSync(target, alias);
    const actual = executableIdentity(alias);
    assert.equal(actual.path, realpathSync(target));
    assert.ok(sameExecutable(actual, executableIdentity(target)));
    assert.equal(sameExecutable(actual, { ...actual, inode: "0" }), false);
  } finally { f.cleanup(); }
});

test("Linux proc inspector can inspect itself read-only (no signal)", { skip: process.platform !== "linux" }, () => {
  const first = inspectLinuxProcess(process.pid);
  assert.ok(first);
  assert.equal(first.pid, process.pid);
  assert.ok(sameProcess(first, inspectLinuxProcess(process.pid)));
  assert.ok(sameExecutable(first.executable, executableIdentity(process.execPath)));
});
