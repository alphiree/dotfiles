import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { displayText, sanitizeDisplay } from "./terminal-text.ts";

// Offline: load only this extension using Pi's real loader/components. No model,
// subprocess tools, terminal writes, session edits, or auto-discovery.
let piRoot = process.env.PI_PACKAGE_DIR || dirname(realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim()));
while (!existsSync(join(piRoot, "dist/core/extensions/loader.js"))) {
	const parent = dirname(piRoot);
	assert.notEqual(parent, piRoot, "Set PI_PACKAGE_DIR to the installed Pi package root");
	piRoot = parent;
}
const { loadExtensions } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const extensionPath = process.env.ASK_USER_QUESTION_EXTENSION || fileURLToPath(new URL("./index.ts", import.meta.url));
const loaded = await loadExtensions([extensionPath], process.cwd());
assert.deepEqual(loaded.errors, []);
const tool = loaded.extensions[0].tools.get("ask_user_question").definition;
const { CURSOR_MARKER, visibleWidth } = await import(pathToFileURL(join(piRoot, "node_modules/@earendil-works/pi-tui/dist/index.js")));
const theme = {
	fg: (_color, text) => `\x1b[36m${text}\x1b[39m`,
	bold: (text) => `\x1b[1m${text}\x1b[22m`,
};
const attacks = [
	"\x1b]52;c;Y2xpcA==\x07", "\x1b]52;c;Y2xpcA==\x1b\\",
	"\x9d52;c;Y2xpcA==\x9c", "\x1b]8;;https://evil.invalid\x1b\\",
	"\x1b[2J", "\x9b2J", "\x1b[31m", "\x1b[0m",
	...['P', '_', '^', 'X'].map((c) => `\x1b${c}payload\x1b\\`),
	...[0x90, 0x9f, 0x9e, 0x98].map((c) => `${String.fromCharCode(c)}payload\x9c`),
	"\x1b(0", "\x00\x01\x07\x08\x0b\x0c\x0d\x7f\x80\x85\x9c",
];
const malicious = `Hello ${attacks.join("")}世界 🦊\nsecond line`;
const plain = "Hello 世界 🦊\nsecond line";
function assertSafe(lines, width = 200) {
	const output = lines.join("\n");
	// Permit only renderer-owned SGR and the exact editor-owned IME marker.
	const remainder = output.replaceAll(CURSOR_MARKER, "").replace(/\x1b\[(?:36|39|1|22|7|0)m/g, "");
	assert.doesNotMatch(remainder, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
	assert.doesNotMatch(output, /payload|Y2xpcA|evil\.invalid/);
	for (const line of lines) assert.ok(visibleWidth(line) <= width, JSON.stringify(line));
	return remainder;
}
function renderResult(details, content = malicious) {
	return tool.renderResult({ content: [{ type: "text", text: content }], details }, {}, theme).render(200);
}
async function panel(params, interaction) {
	let completed = false;
	const ctx = { mode: "tui", hasUI: true, ui: {
		custom(factory) {
			return new Promise((resolve, reject) => {
				const component = factory({ terminal: { rows: 24 }, requestRender() {} }, theme, {}, (value) => {
					completed = true; resolve(value);
				});
				try { interaction(component); assert.ok(completed, "interaction must finish/cancel"); }
				catch (error) { reject(error); }
			});
		},
	} };
	return tool.execute("test", params, undefined, undefined, ctx);
}
const down = (component, count = 1) => { for (let i = 0; i < count; i++) component.handleInput("\x1b[B"); };
const enter = (component) => component.handleInput("\r");
// Pi filters C0 in bracketed paste itself, but preserves these malicious C1s.
const pasted = "custom \x9d52;c;Y2xpcA==\x9c世界\x9b31m";
const paste = (component) => component.handleInput(`\x1b[200~${pasted}\x1b[201~`);
const options = [{ label: malicious, value: "semantic\x1b]52;c;VALUE\x07", description: malicious }];

test("filter handles every control family, incomplete strings, newlines and Unicode", () => {
	assert.equal(displayText(malicious), plain);
	for (const opening of ["\x1b]", "\x1bP", "\x1b_", "\x1b^", "\x1bX", "\x9d", "\x90", "\x9f", "\x9e", "\x98"])
		assert.equal(displayText(`keep${opening}unterminated\nsecret`), "keep");
	for (const tail of ["\x1b", "\x1b[", "\x1b[31;", "\x9b31;", "\x1b("])
		assert.equal(displayText(`keep${tail}`), "keep");
	assert.equal(displayText("a\r\nb\tc\rd\x1b\x1b]52;c;payload\x07"), "a\nb    cd");
	assert.equal(displayText("e\u0301 中文 🧑‍💻\n\nnext"), "e\u0301 中文 🧑‍💻\n\nnext");
	assert.deepEqual(sanitizeDisplay("a\x1b]52;payload\x07b", 6), { text: "ab", cursor: 1 });
});

test("real tool call/result renderers remove injected controls but retain own styles", () => {
	const call = tool.renderCall({ question: malicious, options, multiSelect: true }, theme).render(200);
	assertSafe(call);
	assert.match(call.join("\n"), /\x1b\[36m/);
	assert.match(call.join("\n"), /\x1b\[1mask_user_question/);
	assert.match(assertSafe(renderResult(undefined)), /世界 🦊/);
	for (const status of ["cancelled", "unavailable"])
		assert.match(assertSafe(renderResult({ status, message: malicious })), /世界 🦊/);
	for (const type of ["text", "other", "option"]) {
		const details = { status: "answered", answers: [{ type, label: malicious, value: malicious, index: 1 }] };
		assert.match(assertSafe(renderResult(details)), /世界 🦊/);
		assert.equal(details.answers[0].label, malicious);
	}
	assertSafe(renderResult({ status: "answered", answers: [{ type: "option", index: "\x1b]52;c;payload\x07", label: "safe" }] }));
});

test("single/multi choice render safely without changing selected values", async () => {
	for (const multiSelect of [false, true]) {
		const result = await panel({ question: malicious, details: malicious, options, multiSelect }, (component) => {
			const initial = component.render(200);
			assert.match(assertSafe(initial), /世界 🦊/);
			assert.match(initial.join("\n"), /\x1b\[36m/);
			enter(component);
			if (multiSelect) { down(component, 2); enter(component); }
		});
		assert.equal(result.details.question, malicious);
		assert.equal(result.details.answers[0].label, malicious);
		assert.equal(result.details.answers[0].value, options[0].value);
		assertSafe(tool.renderResult(result, {}, theme).render(200));
	}
});

test("Other editors and saved multi-choice custom answer sanitize only display", async () => {
	for (const multiSelect of [false, true]) {
		const result = await panel({ question: malicious, details: malicious, options, multiSelect }, (component) => {
			down(component); enter(component); paste(component);
			assert.match(assertSafe(component.render(200)), /custom 世界/);
			enter(component);
			if (multiSelect) {
				assert.match(assertSafe(component.render(200)), /custom 世界/);
				// Reopen the saved answer, exercise setText path and narrow wrapping.
				enter(component); assertSafe(component.render(30), 30); component.handleInput("\x1b");
				down(component); enter(component);
			}
		});
		assert.equal(result.details.answers[0].value, pasted);
		assert.equal(result.details.answers[0].label, pasted);
		assertSafe(tool.renderResult(result, {}, theme).render(200));
	}
});

test("free-form panel title/buffer are safe, answer remains unchanged", async () => {
	const result = await panel({ question: malicious, details: malicious }, (component) => {
		component.focused = true;
		paste(component);
		const lines = component.render(200);
		assert.match(assertSafe(lines), /custom 世界/);
		assert.ok(lines.join("\n").includes(CURSOR_MARKER));
		assertSafe(component.render(20), 20);
		enter(component);
	});
	assert.equal(result.details.answers[0].value, pasted);
	assertSafe(tool.renderResult(result, {}, theme).render(200));
});

test("RPC title sanitized; returned answer is not sanitized", async () => {
	const result = await tool.execute("test", { question: malicious, details: malicious }, undefined, undefined, {
		mode: "rpc", hasUI: true, ui: { editor: async (title) => { assert.equal(title, `${plain}\n\n${plain}`); return malicious; } },
	});
	assert.equal(result.details.answers[0].value, malicious);
});

test("empty submission, cancellation, and no-UI behavior remain supported", async () => {
	const empty = await panel({ question: "Answer?" }, enter);
	assert.equal(empty.details.answers[0].value, "");
	for (const params of [{ question: "Answer?" }, { question: "Pick?", options }, { question: "Pick?", options, multiSelect: true }]) {
		const cancelled = await panel(params, (component) => component.handleInput("\x1b"));
		assert.equal(cancelled.details.status, "cancelled");
	}
	const unavailable = await tool.execute("test", { question: malicious }, undefined, undefined, { hasUI: false });
	assert.equal(unavailable.details.status, "unavailable");
});
