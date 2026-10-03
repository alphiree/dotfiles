import { closeSync, openSync, readFileSync, readlinkSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface ExecutableIdentity {
  path: string;
  device: string;
  inode: string;
}

export interface ProcessIdentity {
  version: 1;
  pid: number;
  bootId: string;
  startTime: string;
  uid: number;
  processGroup: number;
  session: number;
  executable: ExecutableIdentity;
}

export interface CurrentServerInfo {
  alias?: string;
  model?: string;
  pid?: number;
  args?: string[];
  startedAt?: string;
  identity?: ProcessIdentity;
}

export interface ProcessRuntime {
  inspect(pid: number): ProcessIdentity | undefined;
  signal(target: number, signal: "SIGTERM" | "SIGKILL"): void;
  now(): number;
  sleep(ms: number): Promise<void>;
}

function validPid(pid: unknown): pid is number {
  return Number.isSafeInteger(pid) && (pid as number) > 1;
}

export function executableIdentity(path: string): ExecutableIdentity {
  const canonical = realpathSync(path);
  const stat = statSync(canonical, { bigint: true });
  if (!stat.isFile()) throw new Error(`Not an executable file: ${canonical}`);
  return { path: canonical, device: String(stat.dev), inode: String(stat.ino) };
}

export function sameExecutable(a: ExecutableIdentity, b: ExecutableIdentity): boolean {
  return a.path === b.path && a.device === b.device && a.inode === b.inode;
}

export function parseProcStat(raw: string, pid: number) {
  // comm (field 2) may contain spaces and ')' characters.
  const end = raw.lastIndexOf(")");
  if (!raw.startsWith(`${pid} (`) || end < 0) return undefined;
  const fields = raw.slice(end + 1).trim().split(/\s+/);
  const processGroup = Number(fields[2]); // field 5
  const session = Number(fields[3]); // field 6
  const startTime = fields[19]; // field 22; retain precision as a string
  if (!validPid(processGroup) || !validPid(session) || !/^[0-9]+$/.test(startTime ?? "") ||
      ["Z", "X", "x"].includes(fields[0])) return undefined;
  return { processGroup, session, startTime };
}

export function inspectLinuxProcess(pid: number): ProcessIdentity | undefined {
  if (process.platform !== "linux" || !validPid(pid)) return undefined;
  let fd: number | undefined;
  try {
    // Pin this proc directory: inspection cannot mix files from a reused PID.
    fd = openSync(`/proc/${pid}`, "r");
    const base = `/proc/self/fd/${fd}`;
    const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    const before = parseProcStat(readFileSync(`${base}/stat`, "utf8"), pid);
    const uid = Number(statSync(base).uid);
    const exe = `${base}/exe`;
    const path = readlinkSync(exe);
    const stat = statSync(exe, { bigint: true });
    const executable = { path, device: String(stat.dev), inode: String(stat.ino) };
    const after = parseProcStat(readFileSync(`${base}/stat`, "utf8"), pid);
    const lastStat = statSync(exe, { bigint: true });
    if (!before || !after || JSON.stringify(before) !== JSON.stringify(after) ||
        path !== readlinkSync(exe) || stat.dev !== lastStat.dev || stat.ino !== lastStat.ino ||
        !/^[0-9a-f-]{36}$/i.test(bootId) || !path.startsWith("/") || path.endsWith(" (deleted)") ||
        uid !== process.getuid?.()) return undefined;
    return { version: 1, pid, bootId, uid, ...after, executable };
  } catch {
    // Missing /proc, permission denial, exit, and an unstable exec all fail closed.
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export const linuxRuntime: ProcessRuntime = {
  inspect: inspectLinuxProcess,
  signal: (pid, signal) => { process.kill(pid, signal); },
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function validIdentity(value: unknown): value is ProcessIdentity {
  const id = value as ProcessIdentity | undefined;
  return !!id && id.version === 1 && validPid(id.pid) &&
    typeof id.bootId === "string" && /^[0-9a-f-]{36}$/i.test(id.bootId) &&
    typeof id.startTime === "string" && /^[0-9]+$/.test(id.startTime) &&
    Number.isSafeInteger(id.uid) && id.uid >= 0 &&
    validPid(id.processGroup) && validPid(id.session) &&
    typeof id.executable?.path === "string" && id.executable.path.startsWith("/") &&
    typeof id.executable.device === "string" && /^[0-9]+$/.test(id.executable.device) &&
    typeof id.executable.inode === "string" && /^[0-9]+$/.test(id.executable.inode);
}

export function sameProcess(expected: unknown, actual: unknown): boolean {
  if (!validIdentity(expected) || !validIdentity(actual)) return false;
  return expected.pid === actual.pid && expected.bootId === actual.bootId &&
    expected.startTime === actual.startTime && expected.uid === actual.uid &&
    expected.processGroup === actual.processGroup && expected.session === actual.session &&
    sameExecutable(expected.executable, actual.executable);
}

export function ownsProcessGroup(id: ProcessIdentity): boolean {
  // detached spawn creates a new session and group led by this exact process.
  // Other sessions cannot join it; descendants in that session are owned too.
  return validIdentity(id) && id.processGroup === id.pid && id.session === id.pid;
}

interface StateSnapshot {
  pidText?: string;
  currentText?: string;
  current?: CurrentServerInfo;
}

function readText(path: string): string | undefined {
  try { return readFileSync(path, "utf8"); } catch { return undefined; }
}

function snapshot(stateDir: string): StateSnapshot {
  const pidText = readText(join(stateDir, "server.pid"));
  const currentText = readText(join(stateDir, "current.json"));
  let current: CurrentServerInfo | undefined;
  try { current = JSON.parse(currentText ?? "") as CurrentServerInfo; } catch {}
  return { pidText, currentText, current };
}

function unchanged(stateDir: string, saved: StateSnapshot): boolean {
  return saved.pidText === readText(join(stateDir, "server.pid")) &&
    saved.currentText === readText(join(stateDir, "current.json"));
}

function verified(saved: StateSnapshot, runtime: ProcessRuntime): boolean {
  const current = saved.current;
  if (!current || !validPid(current.pid) || Number(saved.pidText?.trim()) !== current.pid ||
      !validIdentity(current.identity) || current.identity.pid !== current.pid ||
      !ownsProcessGroup(current.identity)) return false;
  try { return sameProcess(current.identity, runtime.inspect(current.pid)); } catch { return false; }
}

export function getVerifiedCurrent(stateDir: string, runtime = linuxRuntime): CurrentServerInfo | undefined {
  const saved = snapshot(stateDir);
  if (!verified(saved, runtime) || !unchanged(stateDir, saved)) return undefined;
  return saved.current;
}

function discard(stateDir: string, saved: StateSnapshot) {
  // Do not remove state published by another supervisor while we were waiting.
  if (!unchanged(stateDir, saved)) return;
  for (const name of ["server.pid", "current.json"]) {
    try { unlinkSync(join(stateDir, name)); } catch {}
  }
}

export async function stopVerifiedServer(stateDir: string, timeout: number, runtime = linuxRuntime): Promise<boolean> {
  const saved = snapshot(stateDir);
  const authorized = () => unchanged(stateDir, saved) && verified(saved, runtime) && unchanged(stateDir, saved);
  if (!authorized()) {
    // Legacy PID-only records are forgotten, never adopted or killed.
    discard(stateDir, saved);
    return false;
  }
  const pid = saved.current!.pid!;
  const signal = (kind: "SIGTERM" | "SIGKILL") => {
    // Re-inspect immediately before EVERY kill, including escalation. No raw
    // PID fallback on group-signal failure. No await between check and kill.
    if (!authorized()) return false;
    runtime.signal(-pid, kind);
    return true;
  };
  if (!signal("SIGTERM")) {
    discard(stateDir, saved);
    return false;
  }
  const started = runtime.now();
  while (runtime.now() - started < timeout && authorized()) await runtime.sleep(300);
  // signal() performs a fresh check even if the final polling check matched.
  signal("SIGKILL");
  discard(stateDir, saved);
  return true;
}

// /proc checks + Node's numeric kill cannot be atomic: the process can exit
// between the final check and the syscall (and a group can outlive its leader).
// Never escalate after losing the verified leader, even if descendants remain.
// Eliminating that final PID-reuse window requires a pidfd-aware native helper
// for individual signals, or an owned cgroup/supervisor for group termination.
// Cooperating managers must still hold their existing server-use lock while
// mutating state; content rechecks are not an atomic filesystem transaction.
// Unknown/inaccessible identity can leave a live server needing manual cleanup.
// State directories/config are trusted, same-user data, not authentication
// against an attacker who can rewrite state or mutate the executable in place.
