// Dictation wire protocol adapted from pi-codex-conversion 3.0.35.
// Same endpoint, model, PCM format, noise reduction and explicit commit behavior.
import { EnvHttpProxyAgent, WebSocket } from "undici";
import type { VoiceAuth } from "./auth.ts";

export const TRANSCRIPTION_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
export const SESSION_UPDATE = {
	type: "session.update",
	session: {
		type: "transcription",
		audio: { input: {
			format: { type: "audio/pcm", rate: 24000 },
			noise_reduction: { type: "near_field" },
			transcription: { model: "gpt-4o-mini-transcribe" },
			turn_detection: null,
		} },
	},
};

type Socket = Pick<WebSocket, "addEventListener" | "send" | "close" | "bufferedAmount">;
type Connection = { socket: Socket; dispose: () => Promise<void> };
type Connector = (auth: VoiceAuth) => Connection;
type Pending = { resolve: (value?: string) => void; reject: (error: Error) => void };

function connect(auth: VoiceAuth): Connection {
	const env = { ...process.env, ...auth.env };
	const dispatcher = new EnvHttpProxyAgent({
		httpProxy: env.http_proxy ?? env.HTTP_PROXY ?? env.all_proxy ?? env.ALL_PROXY,
		httpsProxy: env.https_proxy ?? env.HTTPS_PROXY ?? env.all_proxy ?? env.ALL_PROXY,
		noProxy: env.no_proxy ?? env.NO_PROXY,
	});
	try {
		const socket = new WebSocket(TRANSCRIPTION_URL, { headers: auth.headers, dispatcher });
		return { socket, dispose: async () => { await dispatcher.destroy(); } };
	} catch (error) {
		void dispatcher.destroy();
		throw error;
	}
}

export class Transcriber {
	private connection?: Connection;
	private pending?: Pending;
	private bytes = 0;
	private closed = false;
	private failure?: Error;
	private ready = false;
	private finishing = false;
	private closing?: Promise<void>;
	private onError: (error: Error) => void;
	private connector: Connector;
	private timeoutMs: number;

	constructor(onError: (error: Error) => void, connector: Connector = connect, timeoutMs = 10000) {
		this.onError = onError;
		this.connector = connector;
		this.timeoutMs = timeoutMs;
	}

	private wait(): Promise<string | undefined> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending = undefined;
				reject(new Error(this.finishing ? "Transcription timed out" : "Dictation connection timed out"));
			}, this.timeoutMs);
			this.pending = {
				resolve: value => { clearTimeout(timer); this.pending = undefined; resolve(value); },
				reject: error => { clearTimeout(timer); this.pending = undefined; reject(error); },
			};
		});
	}

	async open(auth: VoiceAuth): Promise<void> {
		if (this.closed) throw new Error("Dictation cancelled");
		this.connection = this.connector(auth);
		const socket = this.connection.socket;
		const ready = this.wait();
		socket.addEventListener("open", () => {
			if (this.closed) return;
			try { socket.send(JSON.stringify(SESSION_UPDATE)); }
			catch { this.fail(new Error("Failed to configure transcription")); }
		});
		socket.addEventListener("message", event => {
			try { this.receive(event.data); }
			catch (error) { this.fail(error instanceof Error ? error : new Error("Invalid transcription event")); }
		});
		socket.addEventListener("error", () => this.fail(new Error("Codex dictation connection failed; check login and network")));
		socket.addEventListener("close", event => this.fail(new Error(`Codex dictation connection closed (${event.code})`)));
		// Wait for acknowledgement before capturing audio, rather than losing early speech.
		await ready;
	}

	private receive(data: unknown): void {
		if (this.closed || this.failure) return;
		if (typeof data !== "string" || Buffer.byteLength(data) > 72 * 1024) throw new Error("Invalid or oversized transcription event");
		const event = JSON.parse(data);
		if (!event || typeof event.type !== "string") throw new Error("Invalid transcription event");
		if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
			// Show only the provider's error code, never arbitrary content or credentials.
			const code = typeof event.error?.code === "string" && /^[a-z0-9_-]{1,100}$/i.test(event.error.code) ? ` (${event.error.code})` : "";
			throw new Error(`Codex transcription failed${code}`);
		}
		if (!this.ready && (event.type === "session.updated" || event.type === "transcription_session.updated")) {
			this.ready = true;
			this.pending?.resolve();
		}
		if (this.finishing && (event.type === "conversation.item.input_audio_transcription.completed" || event.type === "input_audio_transcription.completed")) {
			if (typeof event.transcript !== "string" || Buffer.byteLength(event.transcript) > 64 * 1024) throw new Error("Invalid transcript");
			this.pending?.resolve(event.transcript.trim() || undefined);
		}
	}

	append(pcm: Buffer): void {
		if (this.closed || this.failure || !this.ready || this.finishing || !pcm.length) return;
		const socket = this.connection!.socket;
		if (socket.bufferedAmount > 1024 * 1024) { this.fail(new Error("Audio upload cannot keep up with recording")); return; }
		try {
			socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcm.toString("base64") }));
			this.bytes += pcm.length;
		} catch { this.fail(new Error("Audio upload failed")); }
	}

	async finish(): Promise<string | undefined> {
		if (this.failure) throw this.failure;
		if (this.closed || !this.ready || this.bytes < 4800) return;
		this.finishing = true;
		const completed = this.wait();
		try { this.connection!.socket.send('{"type":"input_audio_buffer.commit"}'); }
		catch { this.fail(new Error("Transcription commit failed")); }
		return completed;
	}

	private fail(error: Error): void {
		if (this.closed || this.failure) return;
		this.failure = error;
		this.pending?.reject(error);
		this.onError(error);
		void this.close();
	}

	close(): Promise<void> {
		if (this.closing) return this.closing;
		this.closed = true;
		this.pending?.reject(new Error("Dictation cancelled"));
		try { this.connection?.socket.close(); } catch { /* Already closed. */ }
		this.closing = this.connection?.dispose().catch(() => {}) ?? Promise.resolve();
		return this.closing;
	}
}
