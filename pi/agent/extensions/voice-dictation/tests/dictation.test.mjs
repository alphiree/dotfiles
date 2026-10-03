import assert from "node:assert/strict";
import test from "node:test";
import { DictationController, submitEditorDraft } from "../controller.ts";
import { InputMeter } from "../input-level.ts";
import { authHeaders, resolveVoiceAuth } from "../auth.ts";
import { Transcriber, SESSION_UPDATE, TRANSCRIPTION_URL } from "../transcriber.ts";

const pcm = (...samples) => {
	const buffer = Buffer.alloc(samples.length * 2);
	samples.forEach((sample, i) => buffer.writeInt16LE(sample, i * 2));
	return buffer;
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}, vocabulary = []) {
	const statuses = [], notices = [], pasted = [], calls = [];
	let audio, recordError, transcribeError;
	let editor = "";
	const ctx = {
		hasUI: true,
		ui: {
			theme: { fg: (_color, text) => text },
			setStatus: (key, value) => statuses.push(value),
			notify: (text, type) => notices.push({ text, type }),
			pasteToEditor: text => { pasted.push(text); editor += text; },
			getEditorText: () => editor,
			setEditorText: text => { editor = text; },
		},
	};
	const recorder = {
		open: async () => { calls.push("recorder.open"); },
		start: device => { calls.push(["recorder.start", device]); },
		stop: async () => { calls.push("recorder.stop"); audio(pcm(1000)); },
		close: async () => { calls.push("recorder.close"); },
	};
	const transcriber = {
		open: async () => { calls.push("transcriber.open"); },
		append: chunk => { calls.push("audio"); },
		finish: async () => { calls.push("transcriber.finish"); return "A dictated sentence."; },
		close: async () => { calls.push("transcriber.close"); },
	};
	const deps = {
		authenticate: async () => ({ headers: {} }),
		recorder: (onPcm, onError) => { audio = onPcm; recordError = onError; return recorder; },
		transcriber: onError => { transcribeError = onError; return transcriber; },
		...overrides,
	};
	const controller = new DictationController({ inputDevice: "alsa:pipewire", vocabulary }, deps);
	return { controller, ctx, statuses, notices, pasted, calls, recorder, transcriber,
		audio: chunk => audio(chunk), fail: error => recordError(error), networkFail: error => transcribeError(error) };
}

test("toggle records, shows waveform, drains PCM, inserts editable transcript, and closes", async () => {
	const f = fixture();
	assert.equal(f.controller.state, "idle");
	assert.deepEqual(f.calls, []); // No resources started just by construction.
	await f.controller.toggle(f.ctx);
	assert.equal(f.controller.state, "recording");
	assert.deepEqual(f.calls.slice(0, 3), ["recorder.open", "transcriber.open", ["recorder.start", "alsa:pipewire"]]);
	f.audio(pcm(32767, -32768));
	assert.match(f.statuses.at(-1), /\[▁+█\] clipping risk/);
	await f.controller.toggle(f.ctx);
	assert.equal(f.controller.state, "idle");
	assert.deepEqual(f.pasted, ["A dictated sentence."]);
	assert.equal(f.statuses.at(-1), undefined);
	assert.deepEqual(f.calls.slice(-5), ["recorder.stop", "audio", "transcriber.finish", "recorder.close", "transcriber.close"]);
});

test("controller passes static vocabulary on each recording without changing the editor", async () => {
	const f = fixture({}, ["Pi", "tmux"]);
	const prompts = [];
	f.transcriber.open = async (_auth, prompt) => { prompts.push(prompt); };
	f.ctx.ui.setEditorText("Private existing draft");
	for (let i = 0; i < 2; i++) {
		await f.controller.toggle(f.ctx);
		await f.controller.cancel();
	}
	assert.deepEqual(prompts, Array(2).fill("Relevant names and technical terms: Pi, tmux."));
	assert.equal(f.ctx.ui.getEditorText(), "Private existing draft");
});

test("Enter stops capture, sends the full draft once, and clears the editor", async () => {
	const f = fixture(), sent = [];
	const completed = Promise.withResolvers();
	f.transcriber.finish = () => completed.promise;
	f.ctx.ui.setEditorText("Existing draft: ");
	const submit = ctx => submitEditorDraft(ctx, (text, options) => sent.push({ text, options }));
	assert.equal(f.controller.handleEnter(submit), false); // Ordinary Enter when idle.
	await f.controller.toggle(f.ctx);
	assert.equal(f.controller.handleEnter(submit, true), true); // Release/repeat doesn't stop.
	assert.equal(f.controller.state, "recording");
	assert.equal(f.controller.handleEnter(submit), true);
	assert.equal(f.controller.state, "transcribing");
	f.controller.handleEnter(submit, true);
	f.controller.handleEnter(submit); // Another Enter while awaiting transcription.
	assert.deepEqual(sent, []);
	await tick();
	completed.resolve("spoken words");
	await tick();
	assert.deepEqual(sent, [{ text: "Existing draft: spoken words", options: { deliverAs: "steer", expandPromptTemplates: true } }]);
	assert.equal(f.ctx.ui.getEditorText(), "");
	assert.equal(f.calls.filter(c => c === "recorder.stop").length, 1);
	assert.equal(f.controller.state, "idle");
});

test("Enter during review transcription upgrades it to stop-and-send", async () => {
	const f = fixture(), sent = [];
	const completed = Promise.withResolvers();
	f.transcriber.finish = () => completed.promise;
	await f.controller.toggle(f.ctx);
	const stopping = f.controller.finish(); // Ctrl+Alt+D initially requested review.
	await tick();
	f.controller.handleEnter(ctx => submitEditorDraft(ctx, text => sent.push(text)));
	completed.resolve("Send after all.");
	await stopping;
	assert.deepEqual(sent, ["Send after all."]);
});

test("empty or failed transcription never submits the existing draft", async () => {
	for (const fail of [false, true]) {
		const f = fixture(), sent = [];
		f.ctx.ui.setEditorText("Keep my existing draft");
		f.transcriber.finish = async () => { if (fail) throw new Error("Transcription failed"); };
		await f.controller.toggle(f.ctx);
		await f.controller.finish(ctx => submitEditorDraft(ctx, text => sent.push(text)));
		assert.deepEqual(sent, []);
		assert.equal(f.ctx.ui.getEditorText(), "Keep my existing draft");
		assert.equal(f.controller.state, "idle");
	}
});

test("cancel or session shutdown suppresses a pending Enter submission", async () => {
	const f = fixture(), sent = [];
	const completed = Promise.withResolvers();
	f.transcriber.finish = () => completed.promise;
	await f.controller.toggle(f.ctx);
	const stopping = f.controller.finish(ctx => submitEditorDraft(ctx, text => sent.push(text)));
	await tick();
	await f.controller.cancel();
	completed.resolve("Do not send into another session");
	await stopping;
	assert.deepEqual(sent, []);
	assert.deepEqual(f.pasted, []);
});

test("synchronous submission rejection restores the transcribed draft", async () => {
	const f = fixture();
	await f.controller.toggle(f.ctx);
	await f.controller.finish(ctx => submitEditorDraft(ctx, () => { throw new Error("Session unavailable"); }));
	assert.equal(f.ctx.ui.getEditorText(), "A dictated sentence.");
	assert.equal(f.controller.state, "idle");
	assert.equal(f.notices.at(-1).text, "Session unavailable");
});

test("Enter while connecting is consumed without sending unrelated draft", async () => {
	const auth = Promise.withResolvers();
	const f = fixture({ authenticate: () => auth.promise });
	let submitted = false;
	const starting = f.controller.toggle(f.ctx);
	assert.equal(f.controller.handleEnter(() => { submitted = true; }), true);
	assert.equal(submitted, false);
	await f.controller.cancel();
	auth.resolve({ headers: {} });
	await starting;
});

test("silence is a flat waveform, not a warning", async () => {
	const f = fixture();
	await f.controller.toggle(f.ctx);
	f.audio(pcm(0, 0));
	assert.match(f.statuses.at(-1), /\[▁{20}\]/);
	assert.doesNotMatch(f.statuses.at(-1), /quiet|clipping/);
	await f.controller.cancel();
});

test("microphone/network failure cleans up once without inserting text", async () => {
	for (const kind of ["fail", "networkFail"]) {
		const f = fixture();
		await f.controller.toggle(f.ctx);
		f[kind](new Error("Device or network unavailable"));
		await tick();
		assert.equal(f.controller.state, "idle");
		assert.equal(f.statuses.at(-1), undefined);
		assert.equal(f.notices.length, 1);
		assert.deepEqual(f.pasted, []);
		assert.equal(f.calls.filter(c => c === "recorder.close").length, 1);
	}
});

test("shutdown/cancel during auth cannot start a late recording", async () => {
	const auth = Promise.withResolvers();
	const f = fixture({ authenticate: () => auth.promise });
	const start = f.controller.toggle(f.ctx);
	await f.controller.cancel();
	auth.resolve({ headers: {} });
	await start;
	assert.equal(f.controller.state, "idle");
	assert.deepEqual(f.calls, []);
});

test("cancel while transcribing discards late transcript", async () => {
	const completed = Promise.withResolvers();
	const f = fixture();
	f.transcriber.finish = () => completed.promise;
	await f.controller.toggle(f.ctx);
	const stopping = f.controller.finish();
	await tick();
	await f.controller.cancel();
	completed.resolve("Must not be pasted after session switch");
	await stopping;
	assert.deepEqual(f.pasted, []);
	assert.equal(f.controller.state, "idle");
});

test("startup failure cleans up and the next recording can start", async () => {
	const f = fixture();
	f.transcriber.open = async () => { throw new Error("Login rejected"); };
	await f.controller.toggle(f.ctx);
	assert.equal(f.controller.state, "idle");
	assert.equal(f.notices[0].text, "Login rejected");
	f.transcriber.open = async () => {};
	await f.controller.toggle(f.ctx);
	assert.equal(f.controller.state, "recording");
	await f.controller.cancel();
});

test("meter is bounded, scrolls history, preserves interval peaks and ignores malformed PCM", () => {
	const meter = new InputMeter();
	assert.equal(meter.append(Buffer.from([0]), 0), undefined);
	assert.equal(meter.append(pcm(0), 0).waveform, `[${"▁".repeat(20)}]`);
	assert.equal(meter.append(pcm(32767), 50), undefined);
	assert.equal(meter.append(pcm(0), 125).clipping, true);
	let level;
	for (let i = 2; i < 30; i++) level = meter.append(pcm(0), i * 125);
	assert.equal(level.waveform, `[${"▁".repeat(20)}]`);
	assert.equal(level.clipping, false);
});

test("Codex auth uses resolved account credentials without changing providers", async () => {
	const token = `x.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "test-account" } })).toString("base64url")}.x`;
	const headers = authHeaders(token, "test-session");
	assert.equal(headers.authorization, `Bearer ${token}`);
	assert.equal(headers["chatgpt-account-id"], "test-account");
	assert.equal(headers["x-session-id"], "test-session");
	assert.throws(() => authHeaders("secret-invalid-token", "test"), /Codex account ID missing/);
	const ctx = {
		modelRegistry: { getProviderAuth: async id => { assert.equal(id, "openai-codex"); return { auth: { apiKey: token, baseUrl: "https://chatgpt.com/backend-api/codex" } }; } },
		sessionManager: { getSessionId: () => "test-session" },
	};
	assert.deepEqual((await resolveVoiceAuth(ctx)).headers, headers);
	ctx.modelRegistry.getProviderAuth = async () => ({ auth: { apiKey: token, baseUrl: "https://proxy.example/codex" } });
	await assert.rejects(resolveVoiceAuth(ctx), /official Codex login/);
});

class FakeSocket extends EventTarget {
	bufferedAmount = 0;
	sent = [];
	closed = false;
	onSend;
	send(data) { const event = JSON.parse(data); this.sent.push(event); this.onSend?.(event); }
	close() { this.closed = true; }
	receive(data) { this.dispatchEvent(new MessageEvent("message", { data: typeof data === "string" ? data : JSON.stringify(data) })); }
}
function wire(timeout = 100) {
	const socket = new FakeSocket();
	const errors = [];
	let disposed = 0;
	const transcriber = new Transcriber(error => errors.push(error), () => ({ socket, dispose: async () => { disposed++; } }), timeout);
	return { socket, errors, transcriber, disposed: () => disposed };
}
async function openWire(f, prompt) {
	const opening = f.transcriber.open({ headers: {} }, prompt);
	f.socket.dispatchEvent(new Event("open"));
	f.socket.receive({ type: "session.updated" });
	await opening;
}

test("transcription keeps the original protocol and waits for setup acknowledgement", async () => {
	const f = wire();
	const opening = f.transcriber.open({ headers: {} });
	f.socket.dispatchEvent(new Event("open"));
	assert.deepEqual(f.socket.sent[0], SESSION_UPDATE);
	assert.equal(SESSION_UPDATE.session.audio.input.transcription.model, "gpt-4o-mini-transcribe");
	assert.equal(TRANSCRIPTION_URL, "wss://api.openai.com/v1/realtime?intent=transcription");
	f.transcriber.append(Buffer.alloc(4800));
	assert.equal(f.socket.sent.length, 1);
	f.socket.receive({ type: "session.updated" });
	await opening;
	f.transcriber.append(Buffer.alloc(4800));
	assert.equal(f.socket.sent[1].type, "input_audio_buffer.append");
	const result = f.transcriber.finish();
	assert.equal(f.socket.sent[2].type, "input_audio_buffer.commit");
	f.socket.receive({ type: "conversation.item.input_audio_transcription.completed", transcript: " hello " });
	assert.equal(await result, "hello");
	await f.transcriber.close();
	await f.transcriber.close();
	assert.equal(f.disposed(), 1);
});

test("vocabulary uses only the existing setup message and never leaks into another run", async () => {
	const f = wire();
	const prompt = "Relevant names and technical terms: Pi, tmux.";
	await openWire(f, prompt);
	assert.equal(f.socket.sent.length, 1);
	const configured = structuredClone(f.socket.sent[0]);
	assert.equal(configured.session.audio.input.transcription.prompt, prompt);
	delete configured.session.audio.input.transcription.prompt;
	assert.deepEqual(configured, SESSION_UPDATE); // All other wire settings stay unchanged.
	assert.equal(SESSION_UPDATE.session.audio.input.transcription.prompt, undefined);
	await f.transcriber.close();
	const plain = wire();
	await openWire(plain);
	assert.deepEqual(plain.socket.sent, [SESSION_UPDATE]);
	await plain.transcriber.close();
});

test("too-short recording is not committed", async () => {
	const f = wire(); await openWire(f);
	f.transcriber.append(Buffer.alloc(20));
	assert.equal(await f.transcriber.finish(), undefined);
	assert.ok(!f.socket.sent.some(e => e.type === "input_audio_buffer.commit"));
	await f.transcriber.close();
});

test("cancel rejects in-flight setup and closes the socket", async () => {
	const f = wire();
	const opening = f.transcriber.open({ headers: {} });
	await f.transcriber.close();
	await assert.rejects(opening, /cancelled/);
	assert.equal(f.socket.closed, true);
});

test("malformed/server errors and upload backpressure fail safely", async () => {
	for (const trigger of [
		f => f.socket.receive("not JSON"),
		f => f.socket.receive({ type: "error", error: { code: "invalid_session", message: "never echo this" } }),
		f => { f.socket.bufferedAmount = 2 * 1024 * 1024; f.transcriber.append(Buffer.alloc(20)); },
	]) {
		const f = wire(); await openWire(f);
		trigger(f);
		await tick();
		assert.equal(f.errors.length, 1);
		assert.doesNotMatch(f.errors[0].message, /never echo this/);
		assert.equal(f.socket.closed, true);
	}
});

test("transcription completion timeout is bounded", async () => {
	const f = wire(10); await openWire(f);
	f.transcriber.append(Buffer.alloc(4800));
	await assert.rejects(f.transcriber.finish(), /timed out/);
	await f.transcriber.close();
});
