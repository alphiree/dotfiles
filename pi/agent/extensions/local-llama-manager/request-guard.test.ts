// Real Pi JSON-mode path against a tiny fake HTTP server (no GGUF/model load).
// Requires Linux and the installed `pi` CLI; core mocked tests need neither.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildServerArgs } from "../local-llama-manager.ts";
import { inspectLinuxProcess, ownsProcessGroup } from "./process-identity.ts";

async function runPi(dir: string, extension: string, driver?: string, prompts = ["Say hello"]) {
  const env = { ...process.env, PI_CODING_AGENT_DIR: dir, PI_CODING_AGENT_SESSION_DIR: join(dir, "sessions"), PI_OFFLINE: "1", PI_TELEMETRY: "0" };
  for (const key of Object.keys(env)) if (key.startsWith("PI_SUBAGENT_")) delete env[key];
  const child = spawn(process.env.PI_TEST_CLI ?? "pi", [
    "--no-extensions", "--no-skills", "--no-context-files", "--no-tools", "--no-session", "--no-approve",
    "-e", extension, ...(driver ? ["-e", driver] : []),
    "--model", "reuse-test/model", "--thinking", "off", "--mode", "json", ...prompts,
  ], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
  try {
    const [code] = await once(child, "close");
    return { code, output };
  } finally {
    clearTimeout(timeout);
  }
}

test("Pi runtime suppresses incompatible inference; matching config still requests", { skip: process.platform !== "linux", timeout: 90000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), "pi-reuse-runtime-"));
  const stateDir = join(dir, "state");
  mkdirSync(stateDir);
  const requests = join(dir, "requests.jsonl");
  writeFileSync(requests, "");
  const modePath = join(dir, "mode.json");
  writeFileSync(modePath, JSON.stringify({ mode: "normal" }));
  const serverScript = join(dir, "fake-server.mjs");
  writeFileSync(serverScript, `
    import { createServer } from 'node:http';
    import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
    const server = createServer((req, res) => {
      let lock;
      try { lock = JSON.parse(readFileSync(${JSON.stringify(join(stateDir, "server-use.lock"))}, 'utf8')); } catch {}
      appendFileSync(${JSON.stringify(requests)}, JSON.stringify({ method: req.method, url: req.url, lock }) + '\\n');
      if (req.url === '/v1/models') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: [{ id: 'model' }] }));
      } else {
        req.resume();
        const state = JSON.parse(readFileSync(${JSON.stringify(modePath)}, 'utf8'));
        const first = !state.used;
        state.used = true;
        state.count = (state.count ?? 0) + 1;
        writeFileSync(${JSON.stringify(modePath)}, JSON.stringify(state));
        if (state.mode === 'overflow' && state.count === 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'context_length_exceeded: fake overflow', type: 'invalid_request_error' } }));
          return;
        }
        res.setHeader('Content-Type', 'text/event-stream');
        const chunk = { id: 'fake', object: 'chat.completion.chunk', created: 1, model: 'model', choices: [{ index: 0, delta: { role: 'assistant', content: 'hello' }, finish_reason: null }] };
        res.write('data: ' + JSON.stringify(chunk) + '\\n\\n');
        if (state.mode === 'threshold' && first) chunk.usage = { prompt_tokens: 63000, completion_tokens: 1, total_tokens: 63001 };
        chunk.choices = [{ index: 0, delta: {}, finish_reason: 'stop' }];
        res.end('data: ' + JSON.stringify(chunk) + '\\n\\ndata: [DONE]\\n\\n');
      }
    });
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `);
  const server = spawn(process.execPath, [serverScript], { detached: true, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => {
    server.kill("SIGTERM"); // Only this test's own child, never manager/raw production PIDs.
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  });
  const [data] = await once(server.stdout, "data");
  const port = Number(String(data).trim());
  const identity = inspectLinuxProcess(server.pid!);
  assert.ok(identity && ownsProcessGroup(identity));
  const config = {
    provider: "reuse-test", baseUrl: `http://127.0.0.1:${port}/v1`, port,
    llamaServer: process.execPath, stateDir, stopOnSessionShutdown: false,
    models: { model: { path: "/fake-model.gguf" } },
  };
  writeFileSync(join(dir, "local-llms.json"), JSON.stringify(config));
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ retry: { enabled: false }, compaction: { enabled: false }, cacheWarming: "off" }));
  const extension = fileURLToPath(new URL("../local-llama-manager.ts", import.meta.url));
  const publish = (args: string[]) => {
    writeFileSync(join(stateDir, "server.pid"), String(server.pid));
    writeFileSync(join(stateDir, "current.json"), JSON.stringify({ alias: "model", pid: server.pid, identity, args }));
  };
  const accesses = () => readFileSync(requests, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));

  await t.test("text to vision on busy owned same alias: error is visible, zero HTTP requests, process/lock retained", async () => {
    const mmproj = join(dir, "projector.gguf");
    writeFileSync(mmproj, "GGUFfixture");
    writeFileSync(join(dir, "local-llms.json"), JSON.stringify({ ...config, models: { model: { ...config.models.model, input: ["text", "image"], mmproj } } }));
    publish(buildServerArgs(config, "model", config.models.model));
    const lockPath = join(stateDir, "server-use.lock");
    const lock = JSON.stringify({ ownerId: "other-pi", pid: process.pid, phase: "turn", model: "model", startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() });
    writeFileSync(lockPath, lock);
    const result = await runPi(dir, extension);
    assert.match(result.output, /Restart required: \/local-llm restart model/);
    assert.match(result.output, /"stopReason":"error"/); // Guard becomes an assistant error, not only an extension warning.
    assert.deepEqual(accesses(), []);
    assert.equal(readFileSync(lockPath, "utf8"), lock);
    assert.ok(inspectLinuxProcess(server.pid!));
    unlinkSync(lockPath);
    writeFileSync(join(dir, "local-llms.json"), JSON.stringify(config));
  });

  await t.test("idle stale server survives rejected request and automatic session shutdown", async () => {
    writeFileSync(join(dir, "local-llms.json"), JSON.stringify({ ...config, stopOnSessionShutdown: true }));
    publish(["stale-startup-arguments"]);
    const result = await runPi(dir, extension);
    assert.match(result.output, /Restart required/);
    assert.match(result.output, /"stopReason":"error"/);
    assert.deepEqual(accesses(), []);
    assert.ok(inspectLinuxProcess(server.pid!));
    assert.ok(existsSync(join(stateDir, "current.json")));
    writeFileSync(join(dir, "local-llms.json"), JSON.stringify(config));
  });

  await t.test("matching owned startup delegates to standard serializer and succeeds", async () => {
    publish(buildServerArgs(config, "model", config.models.model));
    const result = await runPi(dir, extension);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /"stopReason":"stop"/);
    assert.ok(accesses().some(request => request.method === "POST" && request.url === "/v1/chat/completions"));
    assert.ok(!accesses().some(request => request.url === "/v1/models"));
    assert.ok(!existsSync(join(stateDir, "server-use.lock")));
    assert.ok(inspectLinuxProcess(server.pid!));
    writeFileSync(requests, "");
  });

  // Real installed Pi routes prove that summary callers use this registered
  // provider, not a built-in serializer bypass. Short idle safety is exercised
  // with a deterministic clock in lifecycle.test.ts rather than sleeping here.
  const driver = join(dir, "lifecycle-driver.ts");
  writeFileSync(driver, `
    export default function (pi) {
      for (const name of ['agent_end', 'session_before_compact', 'session_compact']) {
        pi.on(name, (event) => console.log('LIFECYCLE:' + name + ':' + (event.reason ?? '')));
      }
      pi.registerCommand('lifecycle-probe', {
        handler: async (_args, ctx) => {
          await ctx.waitForIdle();
          await new Promise((resolve, reject) => ctx.compact({ onComplete: resolve, onError: reject }));
          const response = await ctx.modelRegistry.complete(ctx.model, {
            messages: [{ role: 'user', content: 'Summarize the conversation', timestamp: Date.now() }],
          }, {});
          if (response.stopReason !== 'stop') throw new Error(response.errorMessage ?? 'summary failed');
          console.log('LIFECYCLE:direct-summary:success');
          const target = ctx.sessionManager.getEntries().find(entry => entry.type === 'message' && entry.message.role === 'user');
          const result = await ctx.navigateTree(target.id, { summarize: true });
          if (result.cancelled) throw new Error('branch summary cancelled');
          console.log('LIFECYCLE:branch-summary:success');
        }
      });
    }
  `);
  for (const mode of ["normal", "threshold", "overflow"]) {
    await t.test(`real Pi ${mode === "normal" ? "manual compaction and direct summary" : mode + " automatic compaction"} retains request ownership`, async () => {
      publish(buildServerArgs(config, "model", config.models.model));
      writeFileSync(requests, "");
      writeFileSync(modePath, JSON.stringify({ mode }));
      writeFileSync(join(dir, "settings.json"), JSON.stringify({ retry: { enabled: false },
        compaction: { enabled: mode !== "normal", reserveTokens: 1024, keepRecentTokens: 0 }, cacheWarming: "off" }));
      const prompts = mode === "normal" ? ["Say hello", "/lifecycle-probe"] : mode === "overflow" ? ["Say hello", "Continue"] : ["Say hello"];
      const result = await runPi(dir, extension, driver, prompts);
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, new RegExp('LIFECYCLE:session_compact:' + (mode === 'normal' ? 'manual' : mode)));
      assert.ok(result.output.indexOf('LIFECYCLE:agent_end:') < result.output.indexOf('LIFECYCLE:session_before_compact:'), result.output);
      if (mode === "normal") {
        assert.match(result.output, /LIFECYCLE:direct-summary:success/);
        assert.match(result.output, /LIFECYCLE:branch-summary:success/);
      }
      const posts = accesses().filter(request => request.method === "POST");
      assert.ok(posts.length >= (mode === "threshold" ? 2 : 4), result.output);
      assert.ok(posts.every(request => request.lock?.phase === "request"), JSON.stringify(posts));
      assert.ok(!existsSync(join(stateDir, "server-use.lock")));
      if (mode === "overflow") {
        // The overflow, summary and successful retry all dispatched with ownership.
        assert.match(result.output, /context_length_exceeded/);
        assert.match(result.output, /LIFECYCLE:session_compact:overflow[\s\S]*"type":"agent_start"/);
        const completed = result.output.split("\n").filter(line => line.startsWith("{"))
          .map(line => JSON.parse(line)).filter(event => event.type === "message_end" && event.message.role === "assistant");
        assert.equal(completed.at(-1)?.message.stopReason, "stop", result.output);
      }
    });
  }
  writeFileSync(requests, "");
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ retry: { enabled: false }, compaction: { enabled: false }, cacheWarming: "off" }));

  await t.test("external same alias fails closed and is never stopped", async () => {
    unlinkSync(join(stateDir, "server.pid"));
    unlinkSync(join(stateDir, "current.json"));
    const result = await runPi(dir, extension);
    assert.match(result.output, /"stopReason":"error"/);
    assert.match(result.output, /not started by this extension/);
    assert.ok(accesses().some(request => request.url === "/v1/models"));
    assert.ok(!accesses().some(request => request.method === "POST"));
    assert.ok(!existsSync(join(stateDir, "server-use.lock")));
    assert.ok(inspectLinuxProcess(server.pid!));
  });
});
