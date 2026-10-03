import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, parseConfig, vocabularyPrompt } from "../config.ts";

function temporaryConfig(t) {
	const dir = mkdtempSync(join(tmpdir(), "voice-config-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return pathToFileURL(join(dir, "config.json"));
}

test("missing config uses system microphone with no vocabulary prompt", t => {
	const config = loadConfig(temporaryConfig(t));
	assert.deepEqual(config, { vocabulary: [] });
	assert.equal(vocabularyPrompt(config.vocabulary), undefined);
});

test("old microphone-only config still works; vocabulary is trimmed and deduplicated", () => {
	assert.deepEqual(parseConfig({ inputDevice: "alsa:pipewire" }), { inputDevice: "alsa:pipewire", vocabulary: [] });
	assert.deepEqual(parseConfig({ inputDevice: " ", vocabulary: [" Pi ", "pi", "tmux", "TMUX", "Node.js"] }), {
		inputDevice: undefined, vocabulary: ["Pi", "tmux", "Node.js"],
	});
	assert.equal(vocabularyPrompt(["Pi", "Node.js"]), "Relevant names and technical terms: Pi, Node.js.");
	assert.equal(vocabularyPrompt([]), undefined);
});

test("malformed configuration is rejected without echoing its contents", t => {
	const path = temporaryConfig(t);
	writeFileSync(path, '{"private-value":');
	assert.throws(() => loadConfig(path), error => {
		assert.match(error.message, /config.json: invalid JSON/);
		assert.doesNotMatch(error.message, /private-value/);
		return true;
	});
	for (const value of [null, [], true, "secret", { inputDevice: 42 },
		{ vocabulary: null }, { vocabulary: "secret" }, { vocabulary: [42] },
		{ vocabulary: [""] }, { vocabulary: ["  "] }, { vocabulary: ["two\nlines"] },
		{ vocabulary: ["tab\tword"] }, { vocabulary: ["bad\u0000term"] }, { vocabulary: ["two\u2028lines"] },
		{ vocabulary: ["x".repeat(65)] }, { vocabulary: Array(33).fill("Pi") },
		{ vocabulary: Array.from({ length: 32 }, (_, i) => `${i}${"x".repeat(40)}`) },
	]) assert.throws(() => parseConfig(value), /voice-dictation\/config.json:/);
});

test("non-missing read errors are not silently treated as defaults", t => {
	const path = temporaryConfig(t);
	assert.throws(() => loadConfig(new URL("./", path)), /could not read configuration/);
});

test("example config loads and an explicit empty list disables hints", t => {
	const example = loadConfig(new URL("../config.json.example", import.meta.url));
	assert.equal(example.inputDevice, undefined);
	assert.deepEqual(example.vocabulary, ["Pi", "Codex", "TypeScript"]);
	const path = temporaryConfig(t);
	writeFileSync(path, JSON.stringify({ vocabulary: [] }));
	assert.equal(vocabularyPrompt(loadConfig(path).vocabulary), undefined);
});
