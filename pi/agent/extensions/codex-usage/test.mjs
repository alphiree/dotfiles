import assert from "node:assert/strict";
import { test } from "node:test";
import extension, { parseUsage, parseHeaders, formatUsage } from "./index.ts";

const NOW = 1_800_000_000_000;
const baseUrl = "https://chatgpt.com/backend-api";
const token = (account = "test-account") => `header.${Buffer.from(JSON.stringify({
  "https://api.openai.com/auth": { chatgpt_account_id: account },
})).toString("base64url")}.signature`;
const bucket = (used = 42, seconds = 604800) => ({
  used_percent: used, limit_window_seconds: seconds, reset_at: NOW / 1000 + seconds,
});
const payload = (primary = bucket(), secondary = null) => ({
  rate_limit: { primary_window: primary, secondary_window: secondary },
});
const headers = (slot = "primary", used = "12", minutes = "300") => ({
  [`x-codex-${slot}-used-percent`]: used,
  [`x-codex-${slot}-window-minutes`]: minutes,
});
const drain = async () => { for (let i = 0; i < 3; i++) await new Promise(setImmediate); };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function fixture(t, { mode = "tui", provider = "openai-codex", base = baseUrl, fetcher, auth } = {}) {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: NOW });
  const handlers = new Map();
  const commands = new Map();
  const statuses = [];
  const notices = [];
  const requests = [];
  let authCalls = 0;
  const ctx = {
    mode, model: { provider, baseUrl: base },
    ui: {
      theme: { fg: (color, text) => { assert.equal(color, "dim"); return text; } },
      setStatus: (key, text) => { assert.equal(key, "codex-usage"); statuses.push(text); },
      notify: (text) => notices.push(text),
    },
    modelRegistry: {
      getProviderAuth: async (id) => {
        assert.equal(id, "openai-codex");
        authCalls++;
        return auth ? auth() : { auth: { apiKey: token(), baseUrl } };
      },
    },
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    return fetcher ? fetcher(url, options) : Response.json(payload());
  });
  extension({ on: (name, handler) => handlers.set(name, handler), registerCommand: (name, command) => commands.set(name, command) });
  const emit = (name, event = {}) => handlers.get(name)?.(event, ctx);
  t.after(() => emit("session_shutdown"));
  return { ctx, requests, statuses, notices, emit, authCalls: () => authCalls,
    status: () => statuses.at(-1), command: (args = "refresh") => commands.get("codex-usage").handler(args, ctx) };
}

test("renders status using the theme's dim footer color", async (t) => {
  const app = fixture(t);
  app.ctx.ui.theme.fg = (color, text) => `<${color}>${text}</${color}>`;
  app.emit("session_start");
  await drain();
  assert.match(app.status(), /^<dim>Codex · week 58% left.*<\/dim>$/);
});

test("labels windows by duration, including weekly-only primary and both windows", () => {
  assert.match(formatUsage(parseUsage(payload(), NOW), NOW), /week 58% left/);
  const text = formatUsage(parseUsage(payload(bucket(20, 18000), bucket(60)), NOW), NOW);
  assert.equal(text, "Codex · week 40% left (resets 7d 0h) · 5h 80% left (resets 5h 0m)");
  assert.equal(formatUsage(parseUsage(payload(bucket(100, 3600)), NOW), NOW).includes("1h 0% left"), true);
  assert.match(formatUsage(parseUsage(payload(bucket(0)), NOW), NOW), /100% left/);
});

test("rejects malformed data and never displays backend strings or placeholder windows", () => {
  for (const input of [null, [], {}, payload({ used_percent: 0 }), payload(bucket(-1)), payload(bucket(101)),
    payload(bucket(null)), payload(bucket(false)), payload(bucket("")), payload(bucket(Infinity)),
    payload(bucket(10, 0)), payload(bucket(10, -1)), payload(bucket(10, 0.5))]) {
    assert.deepEqual(parseUsage(input), {});
  }
  const data = payload(bucket(20));
  data.plan_type = "\x1b]52;c;attack\x07";
  data.rate_limit.primary_window.limit_name = data.plan_type;
  const text = formatUsage(parseUsage(data, NOW), NOW);
  assert.ok(!text.includes("attack") && !text.includes("\x1b"));
  assert.deepEqual(parseHeaders(headers("primary", "", "300")), {});
  assert.deepEqual(parseHeaders(headers("primary", "30", "0")), {});
  assert.deepEqual(parseHeaders({ "x-codex-primary-used-percent": "10" }), {});
  assert.deepEqual(parseHeaders({ "x-other-primary-used-percent": "10" }), {});
  assert.equal(parseHeaders({ "X-Codex-Primary-Used-Percent": "10", "X-Codex-Primary-Window-Minutes": "300" }).primary.used, 10);
});

test("each window ages separately and passing reset never manufactures fresh quota", () => {
  const windows = parseUsage(payload(bucket(20, 18000), bucket(60)), NOW);
  Object.assign(windows, parseHeaders(headers(), NOW + 15 * 60000));
  const text = formatUsage(windows, NOW + 15 * 60000);
  assert.match(text, /week 40% left.*\[stale\].*5h 88% left$/);
  const expired = parseUsage(payload({ ...bucket(42), reset_at: NOW / 1000 - 1 }), NOW);
  assert.match(formatUsage(expired, NOW), /58% left \(resets now\) \[stale\]/);
});

test("uses only the fixed HTTPS endpoint, rejects redirects, and sends no conversation", async (t) => {
  const app = fixture(t);
  app.emit("session_start");
  await drain();
  assert.match(app.status(), /week 58% left/);
  assert.equal(app.requests.length, 1);
  const { url, options } = app.requests[0];
  assert.equal(url, `${baseUrl}/wham/usage`);
  assert.equal(options.redirect, "error");
  assert.deepEqual(options.headers, { authorization: `Bearer ${token()}`, "chatgpt-account-id": "test-account", accept: "application/json" });
  assert.equal(options.body, undefined);
  assert.ok(options.signal instanceof AbortSignal);
});

test("completed runs are throttled, headers do not delay endpoint checks, manual refresh bypasses throttle", async (t) => {
  const app = fixture(t);
  app.emit("session_start");
  await drain();
  app.emit("agent_settled");
  await drain();
  assert.equal(app.requests.length, 1);
  t.mock.timers.tick(60_000);
  app.emit("after_provider_response", { headers: headers("secondary") });
  assert.equal(app.requests.length, 1);
  app.emit("agent_settled");
  await drain();
  assert.equal(app.requests.length, 2);
  await app.command();
  assert.equal(app.requests.length, 3);
});

test("model switches retain cached quota and cannot bypass the automatic throttle", async (t) => {
  const app = fixture(t);
  app.emit("session_start");
  await drain();
  const cached = app.status();
  for (const provider of ["openai-codex", "anthropic", "openai-codex"]) {
    app.ctx.model.provider = provider;
    app.emit("model_select");
    await drain();
  }
  assert.equal(app.requests.length, 1);
  assert.equal(app.status(), cached);
  t.mock.timers.tick(60_000);
  app.emit("model_select");
  await drain();
  assert.equal(app.requests.length, 2);
});

test("idle clock marks stale without network polling and stops on shutdown", async (t) => {
  const app = fixture(t);
  app.emit("session_start");
  await drain();
  t.mock.timers.tick(15 * 60_000);
  assert.match(app.status(), /\[stale\]/);
  assert.equal(app.requests.length, 1);
  app.emit("session_shutdown");
  const count = app.statuses.length;
  t.mock.timers.tick(60_000);
  assert.equal(app.statuses.length, count);
  assert.equal(app.status(), undefined);
});

test("in-flight refreshes coalesce and newer headers win over an older endpoint response", async (t) => {
  const result = deferred();
  const app = fixture(t, { fetcher: () => result.promise });
  app.emit("session_start");
  await drain();
  const first = app.command();
  const second = app.command();
  app.emit("after_provider_response", { headers: headers("primary", "80", "10080") });
  result.resolve(Response.json(payload(bucket(10))));
  await Promise.all([first, second]);
  assert.equal(app.requests.length, 1);
  assert.match(app.status(), /week 20% left/);
});

test("switching providers cancels fetch, clears status, and ignores late responses", async (t) => {
  const result = deferred();
  const app = fixture(t, { fetcher: () => result.promise });
  app.emit("session_start");
  await drain();
  app.ctx.model.provider = "anthropic";
  app.emit("model_select");
  assert.equal(app.requests[0].options.signal.aborted, true);
  result.resolve(Response.json(payload()));
  await drain();
  assert.equal(app.status(), undefined);
  assert.equal(app.requests.length, 1);
});

test("shutdown during authentication never starts a request", async (t) => {
  const result = deferred();
  const app = fixture(t, { auth: () => result.promise });
  app.emit("session_start");
  app.emit("session_shutdown");
  result.resolve({ auth: { apiKey: token(), baseUrl } });
  await drain();
  assert.equal(app.requests.length, 0);
  assert.equal(app.status(), undefined);
});

test("non-TUI and other providers do not resolve auth or make requests", async (t) => {
  const app = fixture(t, { mode: "print" });
  app.emit("session_start");
  await app.command();
  app.ctx.mode = "tui";
  app.ctx.model.provider = "codex-clone";
  app.emit("model_select");
  app.emit("agent_settled");
  await app.command();
  assert.equal(app.authCalls(), 0);
  assert.equal(app.requests.length, 0);
});

test("unsafe model endpoints and unsafe resolved auth endpoints are rejected", async (t) => {
  const app = fixture(t, { auth: () => ({ auth: { apiKey: token(), baseUrl: "https://evil.example" } }) });
  for (const base of ["http://chatgpt.com", "https://chatgpt.com.evil.example", "https://chatgpt.com@evil.example", "https://chatgpt.com:444", "https://user@chatgpt.com", "bad-url"]) {
    app.ctx.model.baseUrl = base;
    app.emit("session_start");
    await drain();
  }
  assert.equal(app.authCalls(), 0);
  app.ctx.model.baseUrl = baseUrl;
  app.emit("model_select");
  await drain();
  assert.equal(app.requests.length, 0);
  assert.equal(app.status(), "Codex · unavailable");
});

test("missing or malformed authentication is unavailable, never leaked", async (t) => {
  let auth;
  const app = fixture(t, { auth: () => auth });
  for (const key of [undefined, "not-a-jwt", token("\r\nInjected: secret")]) {
    auth = key ? { auth: { apiKey: key, baseUrl } } : undefined;
    app.emit("session_start");
    await drain();
    assert.equal(app.status(), "Codex · unavailable");
  }
  assert.equal(app.requests.length, 0);
});

test("failed requests keep cached quota with a failure marker, throttle retries, and do not expose errors", async (t) => {
  let fail = false;
  const app = fixture(t, { fetcher: () => {
    if (fail) throw new Error(`secret token ${token()}`);
    return Response.json(payload());
  } });
  app.emit("session_start");
  await drain();
  fail = true;
  await app.command();
  assert.match(app.status(), /week 58% left.*refresh failed/);
  assert.ok(!app.status().includes("secret"));
  app.emit("agent_settled");
  await drain();
  assert.equal(app.requests.length, 2);
  fail = false;
  await app.command();
  assert.ok(!app.status().includes("failed"));
});

test("rejects HTTP failures, invalid JSON, missing quota, and oversized responses", async (t) => {
  let response;
  const app = fixture(t, { fetcher: () => response });
  for (const next of [new Response("secret", { status: 401 }), new Response("secret", { status: 302 }),
    new Response("not json"), Response.json({}), new Response("x".repeat(65_537))]) {
    response = next;
    app.emit("session_start");
    await drain();
    assert.equal(app.status(), "Codex · unavailable");
  }
});

test("authoritative endpoint clears removed windows and account changes clear old quota", async (t) => {
  let data = payload(bucket(20, 18000), bucket(60));
  let account = "first";
  const app = fixture(t, { fetcher: () => Response.json(data), auth: () => ({ auth: { apiKey: token(account), baseUrl } }) });
  app.emit("session_start");
  await drain();
  assert.match(app.status(), /5h/);
  data = payload(bucket(50));
  await app.command();
  assert.ok(!app.status().includes("5h"));
  account = "second";
  data = {};
  await app.command();
  assert.equal(app.status(), "Codex · unavailable");
});

test("only the refresh argument performs a manual fetch", async (t) => {
  const app = fixture(t);
  app.emit("session_start");
  await drain();
  await app.command("");
  await app.command("unexpected");
  assert.equal(app.requests.length, 1);
  assert.ok(app.notices.every((text) => text.includes("/codex-usage refresh")));
});
