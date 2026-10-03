import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { validateModelVision, buildServerArgs, registerLocalProvider } from "../local-llama-manager.ts";

const config = { provider: "local", baseUrl: "http://localhost:8080/v1", port: 8080, commonArgs: ["--jinja"], models: {} };
function projector(t) {
  const dir = mkdtempSync(join(tmpdir(), "local-vision-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "mmproj.gguf");
  writeFileSync(path, "GGUFtest fixture");
  return { path, dir };
}

test("text-only defaults keep original arguments and advertised limits", () => {
  const model = { path: "/model.gguf", args: ["--ctx-size", "64000"] };
  validateModelVision("text", model);
  assert.deepEqual(buildServerArgs(config, "text", model), ["--model", model.path, "--alias", "text", "--host", "127.0.0.1", "--port", "8080", "--jinja", ...model.args]);
  let provider;
  registerLocalProvider({ registerProvider: (_, value) => { provider = value; } }, { ...config, models: { text: model } });
  assert.deepEqual(provider.models[0].input, ["text"]);
  assert.equal(provider.models[0].contextWindow, 64000);
  assert.equal(provider.models[0].maxTokens, 16000);
});

test("reject malformed capabilities and missing/invalid projectors", t => {
  const { path, dir } = projector(t);
  for (const input of [null, "text", [], ["image"], ["audio"], ["text", "text"], ["text", "image", "image"]]) {
    assert.throws(() => validateModelVision("bad", { path: "model", input }), /Invalid input/);
  }
  for (const mmproj of [undefined, null, 1, "", "   "]) {
    assert.throws(() => validateModelVision("bad", { path: "model", input: ["text", "image"], mmproj }), /requires an mmproj path/);
  }
  for (const mmproj of [dir, join(dir, "missing")]) {
    assert.throws(() => validateModelVision("bad", { path: "model", input: ["text", "image"], mmproj }), /Invalid mmproj/);
  }
  writeFileSync(path, "html");
  assert.throws(() => validateModelVision("bad", { path: "model", input: ["text", "image"], mmproj: path }), /not a GGUF/);
  assert.throws(() => validateModelVision("bad", { path: "model", mmproj: path }), /requires image input/);
});

test("loadConfig resolves projector paths in the config directory and rejects before registration", t => {
  const { path, dir } = projector(t);
  writeFileSync(join(dir, "local-llms.json"), JSON.stringify({
    ...config, llamaServer: "~/llama-server", stateDir: "state",
    models: { vision: { path: "~/model.gguf", input: ["text", "image"], mmproj: "mmproj.gguf" } },
  }));
  const url = new URL("../local-llama-manager.ts", import.meta.url).href;
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { loadConfig } from ${JSON.stringify(url)};
    console.log(JSON.stringify(loadConfig()));
  `], { env: { ...process.env, PI_CODING_AGENT_DIR: dir }, encoding: "utf8" });
  const loaded = JSON.parse(result);
  assert.equal(loaded.models.vision.mmproj, path);
  assert.equal(loaded.stateDir, join(dir, "state"));
  assert.equal(loaded.models.vision.path, join(process.env.HOME, "model.gguf"));
  writeFileSync(path, "bad");
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "-e", `
    import manager from ${JSON.stringify(url)};
    manager({ registerProvider() { throw new Error("should not register"); } });
  `], { env: { ...process.env, PI_CODING_AGENT_DIR: dir }, stdio: "pipe" }), /Invalid mmproj/);
});

test("projector is propagated once, and only selected models advertise image input", t => {
  const { path } = projector(t);
  const model = { path: "/model.gguf", input: ["text", "image"], mmproj: path, args: ["--no-mmproj-offload"] };
  const args = buildServerArgs(config, "vision", model);
  assert.deepEqual(args.slice(args.indexOf("--mmproj"), args.indexOf("--mmproj") + 2), ["--mmproj", path]);
  assert.equal(args.filter(arg => arg === "--mmproj").length, 1);
  let provider;
  registerLocalProvider({ registerProvider: (_, value) => { provider = value; } }, { ...config, models: { vision: model, text: { path: "text.gguf", input: ["text"] } } });
  assert.deepEqual(provider.models.map(model => model.input), [["text", "image"], ["text"]]);
  for (const flag of ["--mmproj", "--mmproj=x", "-mm", "--mmproj-url", "-mmu", "--no-mmproj", "--mmproj-auto", "--no-mmproj-auto"]) {
    assert.throws(() => buildServerArgs({ ...config, commonArgs: [flag] }, "vision", model), /conflicts with mmproj/);
    assert.throws(() => buildServerArgs(config, "vision", { ...model, args: [flag] }), /conflicts with mmproj/);
  }
});
