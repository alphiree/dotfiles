import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "openai-codex";
const STATUS = "codex-usage";
const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const REFRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;
const SLOTS = ["primary", "secondary"] as const;
type Slot = typeof SLOTS[number];
type Window = { used: number; seconds: number; reset?: number; observedAt: number };
type Windows = Partial<Record<Slot, Window>>;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function number(value: unknown): number | undefined {
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value) && value.length <= 32) value = Number(value);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function window(usedValue: unknown, secondsValue: unknown, resetValue: unknown, now: number): Window | undefined {
  const used = number(usedValue);
  const seconds = number(secondsValue);
  if (used === undefined || used < 0 || used > 100 || seconds === undefined ||
      !Number.isSafeInteger(seconds) || seconds <= 0) return undefined;
  const reset = number(resetValue);
  return { used, seconds, observedAt: now,
    ...(reset !== undefined && Number.isSafeInteger(reset) && reset > 0 ? { reset } : {}) };
}

export function parseUsage(payload: unknown, now = Date.now()): Windows {
  const limits = record(record(payload).rate_limit);
  const result: Windows = {};
  for (const slot of SLOTS) {
    const data = record(limits[`${slot}_window`]);
    const parsed = window(data.used_percent, data.limit_window_seconds, data.reset_at, now);
    if (parsed) result[slot] = parsed;
  }
  return result;
}

export function parseHeaders(headers: Record<string, string>, now = Date.now()): Windows {
  const values = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const result: Windows = {};
  for (const slot of SLOTS) {
    const prefix = `x-codex-${slot}`;
    const minutes = number(values.get(`${prefix}-window-minutes`));
    const parsed = window(values.get(`${prefix}-used-percent`),
      minutes === undefined ? undefined : minutes * 60, values.get(`${prefix}-reset-at`), now);
    if (parsed) result[slot] = parsed;
  }
  return result;
}

function duration(seconds: number): string {
  if (seconds === 604_800) return "week";
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function countdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function formatUsage(windows: Windows, now = Date.now()): string {
  const parts = Object.values(windows).sort((a, b) => b.seconds - a.seconds).map((item) => {
    const stale = now - item.observedAt >= STALE_MS || (item.reset !== undefined && item.reset * 1000 <= now);
    const reset = item.reset === undefined ? "" : ` (resets ${countdown(item.reset - now / 1000)})`;
    return `${duration(item.seconds)} ${Math.round(100 - item.used)}% left${reset}${stale ? " [stale]" : ""}`;
  });
  return `Codex · ${parts.join(" · ") || "unavailable"}`;
}

function officialBase(base: string): boolean {
  try {
    const url = new URL(base);
    return url.origin === "https://chatgpt.com" && !url.username && !url.password;
  } catch { return false; }
}

function accountId(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || token.length > 65_536) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const id = record(record(payload)["https://api.openai.com/auth"]).chatgpt_account_id;
    return typeof id === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(id) ? id : undefined;
  } catch { return undefined; }
}

async function fetchUsage(token: string, account: string, signal: AbortSignal): Promise<Windows> {
  const response = await fetch(ENDPOINT, {
    headers: { authorization: `Bearer ${token}`, "chatgpt-account-id": account, accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("Usage unavailable");
  }
  // Bound the decoded response, not just Content-Length. Never display server text.
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 65_536) throw new Error("Usage response too large");
    chunks.push(chunk);
  }
  const windows = parseUsage(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (!Object.keys(windows).length) throw new Error("Usage unavailable");
  return windows;
}

export default function codexUsage(pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let windows: Windows = {};
  let account: string | undefined;
  let lastAttempt = -Infinity;
  let failed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let request: { controller: AbortController; promise: Promise<void> } | undefined;

  function active(context: ExtensionContext): boolean {
    return context.mode === "tui" && context.model?.provider === PROVIDER && officialBase(context.model.baseUrl);
  }

  function render() {
    if (!ctx || !active(ctx)) return;
    const text = Object.keys(windows).length ? formatUsage(windows)
      : request ? "Codex · refreshing" : "Codex · unavailable";
    ctx.ui.setStatus(STATUS, ctx.ui.theme.fg("dim",
      text + (failed && Object.keys(windows).length ? " · refresh failed" : "")));
  }

  function stop() {
    request?.controller.abort();
    request = undefined;
    if (timer) clearInterval(timer);
    timer = undefined;
    ctx?.ui.setStatus(STATUS, undefined);
    ctx = undefined;
  }

  function reset() {
    stop();
    windows = {};
    account = undefined;
    failed = false;
    lastAttempt = -Infinity;
  }

  function refresh(force = false): Promise<void> {
    if (!ctx || !active(ctx)) return Promise.resolve();
    if (request) return request.promise;
    if (!force && Date.now() - lastAttempt < REFRESH_MS) return Promise.resolve();
    lastAttempt = Date.now();
    const context = ctx;
    const pending = { controller: new AbortController(), promise: Promise.resolve() };
    request = pending;
    failed = false;
    render();
    pending.promise = (async () => {
      try {
        const auth = await context.modelRegistry.getProviderAuth(PROVIDER);
        if (request !== pending) return;
        const token = auth?.auth.apiKey;
        const nextAccount = token ? accountId(token) : undefined;
        if (!token || !nextAccount || !officialBase(auth?.auth.baseUrl ?? context.model!.baseUrl)) {
          windows = {};
          account = undefined;
          throw new Error("Usage unavailable");
        }
        if (account !== nextAccount) windows = {};
        account = nextAccount;
        const before = { ...windows };
        const next = await fetchUsage(token, account, pending.controller.signal);
        if (request !== pending) return;
        // A response-header update received during the fetch is newer for that slot.
        for (const slot of SLOTS) {
          if (windows[slot] !== before[slot]) continue;
          if (next[slot]) windows[slot] = next[slot];
          else delete windows[slot];
        }
      } catch {
        if (request === pending) failed = true;
      } finally {
        if (request === pending) {
          request = undefined;
          render();
        }
      }
    })();
    return pending.promise;
  }

  function start(context: ExtensionContext) {
    stop();
    if (!active(context)) return;
    ctx = context;
    render();
    // Display-only clock: updates countdowns and stale markers, never makes requests.
    timer = setInterval(render, 30_000);
    timer.unref();
    void refresh();
  }

  pi.on("session_start", (_event, context) => { reset(); start(context); });
  pi.on("model_select", (_event, context) => start(context));
  pi.on("session_shutdown", reset);
  pi.on("agent_settled", (_event, context) => {
    if (ctx && active(context)) void refresh();
  });
  pi.on("after_provider_response", (event, context) => {
    if (!ctx || !active(context)) return;
    Object.assign(windows, parseHeaders(event.headers));
    render();
  });
  pi.registerCommand("codex-usage", {
    description: "Refresh Codex quota: /codex-usage refresh",
    getArgumentCompletions: (prefix) => "refresh".startsWith(prefix)
      ? [{ value: "refresh", label: "refresh" }] : null,
    handler: async (args, context) => {
      if (context.mode !== "tui") return;
      if (args.trim() !== "refresh") {
        context.ui.notify("Use /codex-usage refresh. Usage is shown in the status bar.", "info");
        return;
      }
      if (!active(context)) {
        context.ui.notify("Select the built-in OpenAI Codex provider with its official endpoint.", "warning");
        return;
      }
      await refresh(true);
    },
  });
}
