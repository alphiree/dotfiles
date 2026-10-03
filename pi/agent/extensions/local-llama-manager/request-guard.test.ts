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

async function runPi(dir: string, extension: string) {
  const env = { ...process.env, PI_CODING_AGENT_DIR: dir, PI_CODING_AGENT_SESSION_DIR: join(dir, "sessions"), PI_OFFLINE: "1", PI_TELEMETRY: "0" };
  for (const key of Object.keys(env)) if (key.startsWith("PI_SUBAGENT_")) delete env[key];
  const child = spawn(process.env.PI_TEST_CLI ?? "pi", [
    "--no-extensions", "--no-skills", "--no-context-files", "--no-tools", "--no-session", "--no-approve",
    "-e", extension, "--model", "reuse-test/model", "--thinking", "off", "--mode", "json", "Say hello",
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

test("Pi runtime suppresses inference after swallowed startup errors; matching config still requests", { skip: process.platform !== "linux", timeout: 90000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), "pi-reuse-runtime-"));
  const stateDir = join(dir, "state");
  mkdirSync(stateDir);
  const requests = join(dir, "requests.jsonl");
  writeFileSync(requests, "");
  const serverScript = join(dir, "fake-server.mjs");
  writeFileSync(serverScript, `
    import { createServer } from 'node:http';
    import { appendFileSync } from 'node:fs';
    const server = createServer((req, res) => {
      appendFileSync(${JSON.stringify(requests)}, JSON.stringify({ method: req.method, url: req.url }) + '\\n');
      if (req.url === '/v1/models') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: [{ id: 'model' }] }));
      } else {
        req.resume();
        res.setHeader('Content-Type', 'text/event-stream');
        const chunk = { id: 'fake', object: 'chat.completion.chunk', created: 1, model: 'model', choices: [{ index: 0, delta: { role: 'assistant', content: 'hello' }, finish_reason: null }] };
        res.write('data: ' + JSON.stringify(chunk) + '\\n\\n');
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

  await t.test("external same alias fails closed and is never stopped", async () => {
    unlinkSync(join(stateDir, "server.pid"));
    unlinkSync(join(stateDir, "current.json"));
    const result = await runPi(dir, extension);
    assert.match(result.output, /"stopReason":"error"/);
    assert.match(result.output, /No verified extension-owned/);
    assert.ok(accesses().some(request => request.url === "/v1/models"));
    assert.ok(!accesses().some(request => request.method === "POST"));
    assert.ok(!existsSync(join(stateDir, "server-use.lock")));
    assert.ok(inspectLinuxProcess(server.pid!));
  });
});
