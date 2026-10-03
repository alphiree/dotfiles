import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { promisify } from "node:util";

interface LocalModelConfig {
  name?: string;
  path: string;
  contextWindow?: number;
  maxTokens?: number;
  args?: string[];
}

interface Config {
  provider: string;
  baseUrl: string;
  port: number;
  llamaServer: string;
  stateDir: string;
  stopWhenLeavingLocalProvider?: boolean;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  idleShutdownMs?: number;
  stopOnSessionShutdown?: boolean;
  commonArgs?: string[];
  models: Record<string, LocalModelConfig>;
}

interface CurrentServerInfo {
  alias?: string;
  model?: string;
  pid?: number;
  args?: string[];
  startedAt?: string;
}

type ServerLockPhase = "loading" | "turn";

interface ServerLockInfo {
  ownerId: string;
  pid: number;
  phase: ServerLockPhase;
  model?: string;
  sessionFile?: string;
  cwd?: string;
  startedAt: string;
  heartbeatAt: string;
}

type ReleaseLock = () => void;

const CONFIG_DIR = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? "", ".pi/agent");
const CONFIG_PATH = join(CONFIG_DIR, "local-llms.json");
const STOP_SHORTCUT = "ctrl+shift+x";
const execFileAsync = promisify(execFile);
const LOCK_POLL_MS = 750;
const LOCK_HEARTBEAT_MS = 2000;
const LOCK_STALE_MS = 6 * 60 * 60 * 1000;

function expandPath(path: string): string {
  if (path === "~") return process.env.HOME ?? path;
  if (path.startsWith("~/")) return join(process.env.HOME ?? "", path.slice(2));
  return path.replace(/\$\{HOME\}|\$HOME/g, process.env.HOME ?? "");
}

function resolveConfigPath(path: string): string {
  const expanded = expandPath(path);
  return isAbsolute(expanded) ? expanded : join(CONFIG_DIR, expanded);
}

function loadConfig(): Config {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config;
  config.llamaServer = expandPath(config.llamaServer);
  config.stateDir = resolveConfigPath(config.stateDir);
  for (const model of Object.values(config.models)) {
    model.path = expandPath(model.path);
  }
  return config;
}

function ensureStateDir(config: Config) {
  mkdirSync(config.stateDir, { recursive: true });
}

function pidPath(config: Config) {
  return join(config.stateDir, "server.pid");
}

function currentPath(config: Config) {
  return join(config.stateDir, "current.json");
}

function logPath(config: Config) {
  return join(config.stateDir, "llama-server.log");
}

function lockPath(config: Config) {
  return join(config.stateDir, "server-use.lock");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPid(config: Config): number | undefined {
  try {
    const raw = readFileSync(pidPath(config), "utf8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readCurrent(config: Config): CurrentServerInfo | undefined {
  try {
    return JSON.parse(readFileSync(currentPath(config), "utf8")) as CurrentServerInfo;
  } catch {
    return undefined;
  }
}

function getManagedCurrent(config: Config): CurrentServerInfo | undefined {
  const current = readCurrent(config);
  const pid = current?.pid ?? readPid(config);
  if (!current?.alias || !pid || !processAlive(pid)) return undefined;
  return { ...current, pid };
}

function readLock(config: Config): ServerLockInfo | undefined {
  try {
    return JSON.parse(readFileSync(lockPath(config), "utf8")) as ServerLockInfo;
  } catch {
    return undefined;
  }
}

function isLockStale(lock: ServerLockInfo): boolean {
  if (!Number.isFinite(lock.pid) || lock.pid <= 0) return true;
  if (!processAlive(lock.pid)) return true;
  const heartbeat = Date.parse(lock.heartbeatAt || lock.startedAt || "");
  return Number.isFinite(heartbeat) && Date.now() - heartbeat > LOCK_STALE_MS;
}

function removeLockIfOwned(config: Config, ownerId: string): boolean {
  const lock = readLock(config);
  if (lock?.ownerId !== ownerId) return false;
  try { unlinkSync(lockPath(config)); } catch {}
  return true;
}

function removeLockIfStale(config: Config): boolean {
  const lock = readLock(config);
  if (!lock || !isLockStale(lock)) return false;
  try { unlinkSync(lockPath(config)); } catch {}
  return true;
}

function ctxSessionFile(ctx: any | undefined): string | undefined {
  if (!ctx) return undefined;
  try {
    return ctx.sessionManager?.getSessionFile?.();
  } catch {
    return undefined;
  }
}

function describeLock(lock: ServerLockInfo): string {
  const parts = [
    lock.phase === "turn" ? "active turn" : "model load",
    lock.model ? `model=${lock.model}` : undefined,
    `pid=${lock.pid}`,
    lock.sessionFile ? `session=${basename(lock.sessionFile)}` : undefined,
  ].filter(Boolean);
  return parts.join(", ");
}

async function acquireServerLock(
  config: Config,
  ctx: any | undefined,
  model: string,
  phase: ServerLockPhase,
  wait: boolean,
): Promise<ReleaseLock | undefined> {
  ensureStateDir(config);
  const ownerId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let notified = false;

  while (true) {
    removeLockIfStale(config);

    const now = new Date().toISOString();
    const lock: ServerLockInfo = {
      ownerId,
      pid: process.pid,
      phase,
      model,
      sessionFile: ctxSessionFile(ctx),
      cwd: process.cwd(),
      startedAt: now,
      heartbeatAt: now,
    };

    try {
      writeFileSync(lockPath(config), JSON.stringify(lock, null, 2), { flag: "wx" });
      const heartbeat = setInterval(() => {
        const current = readLock(config);
        if (current?.ownerId !== ownerId) return;
        current.heartbeatAt = new Date().toISOString();
        try { writeFileSync(lockPath(config), JSON.stringify(current, null, 2)); } catch {}
      }, LOCK_HEARTBEAT_MS);
      heartbeat.unref?.();

      return () => {
        clearInterval(heartbeat);
        removeLockIfOwned(config, ownerId);
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
    }

    const existing = readLock(config);
    if (!wait) return undefined;

    if (existing) {
      const message = `waiting for llama.cpp: ${describeLock(existing)}`;
      ctx?.ui?.setStatus?.("local-llm", message);
      if (!notified) {
        ctx?.ui?.notify?.(`llama.cpp server is busy (${describeLock(existing)}). This prompt will wait instead of reloading the model.`, "info");
        notified = true;
      }
    } else {
      ctx?.ui?.setStatus?.("local-llm", "waiting for llama.cpp lock");
    }

    await sleep(LOCK_POLL_MS);
  }
}

async function getServedModelInfo(config: Config): Promise<{ id?: string; sizeBytes?: number; params?: string } | undefined> {
  try {
    const response = await fetch(`${config.baseUrl}/models`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { data?: Array<{ id?: string; meta?: { size?: number; n_params?: number } }> };
    const first = json.data?.[0];
    return first ? { id: first.id, sizeBytes: first.meta?.size, params: first.meta?.n_params ? String(first.meta.n_params) : undefined } : undefined;
  } catch {
    return undefined;
  }
}

async function getServedModel(config: Config): Promise<string | undefined> {
  return (await getServedModelInfo(config))?.id;
}

function formatBytes(bytes?: number): string | undefined {
  if (!bytes || !Number.isFinite(bytes)) return undefined;
  const gib = bytes / 1024 / 1024 / 1024;
  return `${gib.toFixed(2)} GiB`;
}

async function getGpuMemorySummary(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"], { timeout: 2000 });
    const first = stdout.trim().split(/\r?\n/)[0];
    if (!first) return undefined;
    const [used, total] = first.split(",").map((part) => Number(part.trim()));
    if (!Number.isFinite(used) || !Number.isFinite(total)) return undefined;
    return `${(used / 1024).toFixed(1)}/${(total / 1024).toFixed(1)} GiB VRAM`;
  } catch {
    return undefined;
  }
}

async function runtimeSummary(config: Config, alias: string): Promise<string> {
  const current = getManagedCurrent(config);
  const [info, gpu] = await Promise.all([current?.alias ? Promise.resolve(undefined) : getServedModelInfo(config), getGpuMemorySummary()]);
  const lock = readLock(config);
  const pieces = [
    `model=${current?.alias ?? info?.id ?? alias}`,
    formatBytes(info?.sizeBytes) ? `gguf=${formatBytes(info?.sizeBytes)}` : undefined,
    gpu,
    lock ? `busy=${describeLock(lock)}` : "idle",
    `log=${logPath(config)}`,
  ].filter(Boolean);
  return pieces.join(", ");
}

function tailLog(config: Config, maxLines = 10): string {
  try {
    return readFileSync(logPath(config), "utf8").split(/\r?\n/).slice(-maxLines).join("\n").trim();
  } catch {
    return "";
  }
}

async function waitUntilServing(config: Config, alias: string, pid?: number) {
  const timeout = config.startupTimeoutMs ?? 180000;
  const started = Date.now();
  let lastSeen: string | undefined;

  while (Date.now() - started < timeout) {
    if (pid && !processAlive(pid)) {
      const logTail = tailLog(config);
      throw new Error(`llama-server exited before serving ${alias}. Log: ${logPath(config)}${logTail ? `\nRecent log tail:\n${logTail}` : ""}`);
    }
    lastSeen = await getServedModel(config);
    if (lastSeen === alias) return;
    await sleep(1000);
  }

  const logTail = tailLog(config);
  throw new Error(`Timed out waiting for llama-server to serve ${alias}${lastSeen ? `; last served model was ${lastSeen}` : ""}. Log: ${logPath(config)}${logTail ? `\nRecent log tail:\n${logTail}` : ""}`);
}

function idleShutdownDelay(config: Config): number | undefined {
  const value = config.idleShutdownMs;
  return Number.isFinite(value) && value! > 0 ? value : undefined;
}

async function stopManagedServer(config: Config): Promise<boolean> {
  const pid = readPid(config);
  if (!pid) return false;

  if (!processAlive(pid)) {
    try { unlinkSync(pidPath(config)); } catch {}
    try { unlinkSync(currentPath(config)); } catch {}
    return false;
  }

  const timeout = config.shutdownTimeoutMs ?? 15000;
  const started = Date.now();

  try {
    // Spawned detached, so the negative pid targets the process group.
    process.kill(-pid, "SIGTERM");
  } catch {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }

  while (Date.now() - started < timeout) {
    if (!processAlive(pid)) break;
    await sleep(300);
  }

  if (processAlive(pid)) {
    try { process.kill(-pid, "SIGKILL"); } catch {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  }

  try { unlinkSync(pidPath(config)); } catch {}
  try { unlinkSync(currentPath(config)); } catch {}
  return true;
}

async function startServer(config: Config, alias: string, model: LocalModelConfig) {
  if (!existsSync(config.llamaServer)) {
    throw new Error(`llama-server not found: ${config.llamaServer}`);
  }
  if (!existsSync(model.path)) {
    throw new Error(`GGUF not found for ${alias}: ${model.path}`);
  }

  ensureStateDir(config);
  closeSync(openSync(logPath(config), "a"));
  const logFd = openSync(logPath(config), "a");
  const configuredArgs = [...(config.commonArgs ?? []), ...(model.args ?? [])];
  const hasPort = configuredArgs.includes("--port") || configuredArgs.includes("-p");
  const hasHost = configuredArgs.includes("--host");
  const args = [
    "--model", model.path,
    "--alias", alias,
    ...(hasHost ? [] : ["--host", "127.0.0.1"]),
    ...(hasPort ? [] : ["--port", String(config.port)]),
    ...configuredArgs,
  ];

  const child = spawn(config.llamaServer, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
  });

  child.unref();
  writeFileSync(pidPath(config), String(child.pid));
  writeFileSync(currentPath(config), JSON.stringify({ alias, model: model.path, pid: child.pid, args, startedAt: new Date().toISOString() }, null, 2));

  await waitUntilServing(config, alias, child.pid);
}

async function ensureModelRunning(config: Config, alias: string) {
  const model = config.models[alias];
  if (!model) throw new Error(`No local model config found for ${alias}`);

  const current = getManagedCurrent(config);
  if (current?.alias === alias) {
    // Trust the extension-owned state first. When another pi process is using
    // the server, /models may time out even though the requested model is
    // already loaded. Avoid killing/restarting the same model in that case.
    return "already-running";
  }

  const served = await getServedModel(config);
  if (served === alias) return "already-running";

  if (served && served !== alias && !readPid(config)) {
    throw new Error(
      `A llama.cpp server is already serving ${served} on ${config.baseUrl}, but it was not started by this extension. Stop it manually, then select ${alias} again.`
    );
  }

  await stopManagedServer(config);
  await startServer(config, alias, model);
  return "started";
}

function latestModelChangeEntry(ctx: any): any {
  return [...ctx.sessionManager.getBranch()]
    .reverse()
    .find((entry: any) => entry.type === "model_change");
}

function registerLocalProvider(pi: ExtensionAPI, config: Config) {
  pi.registerProvider(config.provider, {
    name: "llama.cpp local",
    baseUrl: config.baseUrl,
    api: "openai-completions",
    apiKey: "local",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
    models: Object.entries(config.models).map(([id, model]) => ({
      id,
      name: model.name ?? id,
      reasoning: false,
      input: ["text"],
      contextWindow: model.contextWindow ?? 64000,
      maxTokens: model.maxTokens ?? 16000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    })),
  });
}

export default function localLlamaManager(pi: ExtensionAPI) {
  const config = loadConfig();
  ensureStateDir(config);

  registerLocalProvider(pi, config);

  let activeLoad: { id: string; promise: Promise<"started" | "already-running"> } | undefined;
  let activeTurnRelease: ReleaseLock | undefined;
  let modelChangePoller: ReturnType<typeof setInterval> | undefined;
  let idleShutdownTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSeenModelChangeEntryId: string | undefined;

  function cancelIdleShutdown() {
    if (!idleShutdownTimer) return;
    clearTimeout(idleShutdownTimer);
    idleShutdownTimer = undefined;
  }

  function scheduleIdleShutdown(config: Config, alias: string) {
    const delay = idleShutdownDelay(config);
    if (!delay) return;

    cancelIdleShutdown();
    idleShutdownTimer = setTimeout(() => {
      idleShutdownTimer = undefined;
      void (async () => {
        const latestConfig = loadConfig();
        if (!idleShutdownDelay(latestConfig)) return;

        const current = getManagedCurrent(latestConfig);
        if (current?.alias !== alias) return;

        const release = await acquireServerLock(latestConfig, undefined, alias, "loading", false);
        if (!release) {
          scheduleIdleShutdown(latestConfig, alias);
          return;
        }

        try {
          const latestCurrent = getManagedCurrent(latestConfig);
          if (latestCurrent?.alias === alias) {
            await stopManagedServer(latestConfig);
          }
        } finally {
          release();
        }
      })().catch(() => {});
    }, delay);
    idleShutdownTimer.unref?.();
  }

  async function loadLocalModel(config: Config, selectedId: string): Promise<"started" | "already-running"> {
    if (activeLoad?.id === selectedId) return activeLoad.promise;

    const promise = ensureModelRunning(config, selectedId).finally(() => {
      if (activeLoad?.id === selectedId) activeLoad = undefined;
    });
    activeLoad = { id: selectedId, promise };
    return promise;
  }

  async function stopLocalServerFromShortcut(ctx: any): Promise<void> {
    const latestConfig = loadConfig();
    cancelIdleShutdown();

    if (!ctx.isIdle?.()) {
      ctx.ui.notify("Aborting current turn and stopping local llama.cpp server...", "info");
      ctx.abort?.();

      // If this pi instance owns the active turn lock, release it now so the
      // stop shortcut does not wait on itself. Killing llama-server will also
      // force any in-flight local request to end.
      const releaseTurn = activeTurnRelease;
      activeTurnRelease = undefined;
      releaseTurn?.();
    }

    const release = await acquireServerLock(latestConfig, ctx, "stop", "loading", false);
    if (!release) {
      const lock = readLock(latestConfig);
      const detail = lock ? describeLock(lock) : "another pi instance";
      ctx.ui.setStatus("local-llm", `stop skipped; server busy (${detail})`);
      ctx.ui.notify(`Local llama.cpp server is busy (${detail}); not stopping it from the hotkey. Use /local-llm stop if you want to wait for the lock.`, "info");
      return;
    }

    try {
      const stopped = await stopManagedServer(latestConfig);
      ctx.ui.setStatus("local-llm", stopped ? "stopped" : "");
      ctx.ui.notify(stopped ? "Stopped local llama.cpp server" : "No extension-owned local llama.cpp server was running", "info");
    } finally {
      release();
    }
  }

  async function prepareSelectedModel(
    selectedProvider: string | undefined,
    selectedId: string | undefined,
    ctx: any,
    mode: "select" | "queued" | "silent" = "select",
    lockMode: "none" | "try" | "held" = "none",
  ) {
    const latestConfig = loadConfig();
    if (!selectedProvider || !selectedId) return;

    if (selectedProvider === latestConfig.provider) {
      cancelIdleShutdown();
    }

    if (selectedProvider !== latestConfig.provider) {
      if (latestConfig.stopWhenLeavingLocalProvider) {
        const release = await acquireServerLock(latestConfig, ctx, selectedId, "loading", true);
        try {
          const stopped = await stopManagedServer(latestConfig);
          ctx.ui.setStatus("local-llm", stopped ? "stopped" : "");
        } finally {
          release?.();
        }
      } else {
        ctx.ui.setStatus("local-llm", "");
      }
      return;
    }

    let release: ReleaseLock | undefined;
    try {
      if (lockMode === "try") {
        release = await acquireServerLock(latestConfig, ctx, selectedId, "loading", false);
        if (!release) {
          const lock = readLock(latestConfig);
          const current = getManagedCurrent(latestConfig);
          const detail = lock ? describeLock(lock) : "another pi instance";
          ctx.ui.setStatus("local-llm", `selected ${selectedId}; server busy (${detail})`);
          ctx.ui.notify(`Selected ${selectedId}, but llama.cpp is busy (${detail}). It will load/use this model on your next prompt instead of interrupting the other instance.`, "info");
          if (current?.alias === selectedId) {
            ctx.ui.setStatus("local-llm", `selected ${selectedId}; already loaded, busy (${detail})`);
          }
          return "busy";
        }
      }

      if (mode === "queued") {
        ctx.ui.setStatus("local-llm", `message queued; checking ${selectedId}`);
      } else if (mode === "select") {
        ctx.ui.setStatus("local-llm", `loading/checking ${selectedId}`);
      }

      const result = await loadLocalModel(latestConfig, selectedId);
      const summary = await runtimeSummary(latestConfig, selectedId);
      ctx.ui.setStatus("local-llm", result === "started" ? `ready ${summary}` : `running ${summary}`);
      return result;
    } catch (error) {
      ctx.ui.setStatus("local-llm", `failed ${selectedId}; see ${logPath(latestConfig)}`);
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      throw error;
    } finally {
      if (lockMode !== "held") release?.();
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    lastSeenModelChangeEntryId = latestModelChangeEntry(ctx)?.id;
    if (modelChangePoller) clearInterval(modelChangePoller);
    modelChangePoller = setInterval(() => {
      let entry: any;
      try {
        entry = latestModelChangeEntry(ctx);
      } catch {
        // The extension context can become stale after a session replacement,
        // reload, or short-lived subagent/print-mode shutdown before the
        // session_shutdown handler runs. Stop polling instead of crashing the
        // process from this background interval.
        if (modelChangePoller) {
          clearInterval(modelChangePoller);
          modelChangePoller = undefined;
        }
        return;
      }
      if (!entry?.id || entry.id === lastSeenModelChangeEntryId) return;
      lastSeenModelChangeEntryId = entry.id;

      const latestConfig = loadConfig();
      if (entry.provider !== latestConfig.provider || !entry.modelId) return;

      // Pi does not emit model_select when the user selects the already-active
      // model. setModel still appends a model_change entry, so this poller lets
      // re-selecting a stopped local model eagerly load it in the background
      // while preserving the startup behavior of not auto-loading restored local
      // models.
      void prepareSelectedModel(entry.provider, entry.modelId, ctx, "select", "try").catch(() => {});
    }, 1000);
    modelChangePoller.unref?.();

    const active = (ctx as any).model;
    const latestConfig = loadConfig();
    if (active?.provider !== latestConfig.provider || !active?.id) return;

    removeLockIfStale(latestConfig);
    const current = getManagedCurrent(latestConfig);
    const lock = readLock(latestConfig);

    if (current?.alias === active.id) {
      ctx.ui.setStatus("local-llm", `selected ${active.id}; loaded${lock ? `, busy (${describeLock(lock)})` : ", idle"}`);
    } else if (current?.alias) {
      ctx.ui.setStatus("local-llm", `selected ${active.id}; port ${latestConfig.port} currently serves ${current.alias}${lock ? `, busy (${describeLock(lock)})` : ""}`);
    } else {
      const served = await getServedModel(latestConfig);
      if (served === active.id) {
        ctx.ui.setStatus("local-llm", `selected ${active.id}; loaded${lock ? `, busy (${describeLock(lock)})` : ", idle"}`);
      } else if (served) {
        ctx.ui.setStatus("local-llm", `selected ${active.id}; port ${latestConfig.port} currently serves ${served}`);
      } else {
        ctx.ui.setStatus("local-llm", `selected ${active.id}; not running yet, first prompt will load it`);
      }
    }
  });

  pi.on("model_select", (event, ctx) => {
    lastSeenModelChangeEntryId = latestModelChangeEntry(ctx)?.id;

    // Do not await here: awaiting blocks the /model picker from closing until
    // llama.cpp finishes loading. If another pi instance is currently using the
    // server, do not queue an eager model switch; the next prompt will wait and
    // load/use the selected model safely.
    void prepareSelectedModel(event.model.provider, event.model.id, ctx, "select", "try").catch(() => {});
  });

  // Print/JSON mode may start directly with --model without emitting model_select
  // before the first request. Also handles the user submitting a prompt while
  // the selected local model is stopped, loading, or busy in another pi window:
  // the message waits on a cross-process lock instead of restarting the server.
  pi.on("before_agent_start", async (_event, ctx) => {
    const active = (ctx as any).model;
    const latestConfig = loadConfig();
    if (active?.provider !== latestConfig.provider || !active?.id) return;

    const release = await acquireServerLock(latestConfig, ctx, active.id, "turn", true);
    activeTurnRelease = release;
    try {
      await prepareSelectedModel(active.provider, active.id, ctx, "queued", "held");
    } catch (error) {
      activeTurnRelease?.();
      activeTurnRelease = undefined;
      throw error;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    const release = activeTurnRelease;
    activeTurnRelease = undefined;
    release?.();

    const active = (ctx as any).model;
    const latestConfig = loadConfig();
    if (active?.provider === latestConfig.provider && active?.id) {
      ctx.ui.setStatus("local-llm", `running ${await runtimeSummary(latestConfig, active.id)}`);
      scheduleIdleShutdown(latestConfig, active.id);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (modelChangePoller) {
      clearInterval(modelChangePoller);
      modelChangePoller = undefined;
    }
    lastSeenModelChangeEntryId = undefined;

    const release = activeTurnRelease;
    activeTurnRelease = undefined;
    release?.();
    cancelIdleShutdown();

    const latestConfig = loadConfig();
    if (!latestConfig.stopOnSessionShutdown) return;

    const active = (ctx as any)?.model;
    if (active?.provider && active.provider !== latestConfig.provider) return;

    const current = getManagedCurrent(latestConfig);
    if (!current?.alias) return;

    const stopRelease = await acquireServerLock(latestConfig, ctx, current.alias, "loading", false);
    if (!stopRelease) return;
    try {
      await stopManagedServer(latestConfig);
    } finally {
      stopRelease();
    }
  });

  pi.registerShortcut(STOP_SHORTCUT, {
    description: "Stop local llama.cpp server",
    handler: async (ctx) => {
      await stopLocalServerFromShortcut(ctx);
    },
  });

  pi.registerCommand("local-llm", {
    description: `Manage the extension-owned local llama.cpp server: status, stop, restart, logs (hotkey: ${STOP_SHORTCUT})`,
    handler: async (args, ctx) => {
      const latestConfig = loadConfig();
      const [command, modelId] = args.trim().split(/\s+/);

      if (!command || command === "status") {
        removeLockIfStale(latestConfig);
        const pid = readPid(latestConfig);
        const served = getManagedCurrent(latestConfig)?.alias ?? await getServedModel(latestConfig);
        const owned = pid ? processAlive(pid) : false;
        const lock = readLock(latestConfig);
        const gpu = await getGpuMemorySummary();
        ctx.ui.notify(`local-llm status: served=${served ?? "none"}, ownedPid=${pid ?? "none"}, ownedAlive=${owned}, busy=${lock ? describeLock(lock) : "no"}${gpu ? `, ${gpu}` : ""}, log=${logPath(latestConfig)}`, "info");
        return;
      }

      if (command === "stop") {
        cancelIdleShutdown();
        const release = await acquireServerLock(latestConfig, ctx, modelId || "stop", "loading", true);
        try {
          const stopped = await stopManagedServer(latestConfig);
          ctx.ui.setStatus("local-llm", stopped ? "stopped" : "");
          ctx.ui.notify(stopped ? "Stopped local llama.cpp server" : "No extension-owned local llama.cpp server was running", "info");
        } finally {
          release?.();
        }
        return;
      }

      if (command === "restart") {
        cancelIdleShutdown();
        const target = modelId || getManagedCurrent(latestConfig)?.alias || (await getServedModel(latestConfig));
        if (!target) {
          ctx.ui.notify("Usage: /local-llm restart <model-id> (or select a local model first)", "error");
          return;
        }
        const release = await acquireServerLock(latestConfig, ctx, target, "loading", true);
        try {
          await stopManagedServer(latestConfig);
          await ensureModelRunning(latestConfig, target);
          ctx.ui.notify(`Restarted local model: ${target}`, "info");
        } finally {
          release?.();
        }
        return;
      }

      if (command === "logs") {
        ctx.ui.notify(`llama.cpp log: ${logPath(latestConfig)}`, "info");
        return;
      }

      ctx.ui.notify("Usage: /local-llm status | stop | restart [model-id] | logs", "error");
    },
  });
}
