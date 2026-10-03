// JSONL protocol adapted from pi-codex-conversion 3.0.35 (vendor/LICENSE.upstream).
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

export const helperPath = fileURLToPath(new URL(
	`./vendor/${process.platform}-${process.arch}/pi-codex-voice${process.platform === "win32" ? ".exe" : ""}`,
	import.meta.url,
));

type Waiter = { resolve: (event: any) => void; reject: (error: Error) => void };
export class Recorder {
	private child?: ChildProcessWithoutNullStreams;
	private waiters = new Map<string, Waiter>();
	private closed = false;
	private closing?: Promise<void>;
	private onPcm: (pcm: Buffer) => void;
	private onError: (error: Error) => void;

	constructor(onPcm: (pcm: Buffer) => void, onError: (error: Error) => void) {
		this.onPcm = onPcm;
		this.onError = onError;
	}

	private wait(type: string, timeoutMs: number): Promise<any> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiters.delete(type);
				reject(new Error(`Microphone helper timed out waiting for ${type}`));
			}, timeoutMs);
			this.waiters.set(type, {
				resolve: event => { clearTimeout(timer); this.waiters.delete(type); resolve(event); },
				reject: error => { clearTimeout(timer); this.waiters.delete(type); reject(error); },
			});
		});
	}

	async open(): Promise<void> {
		if (this.closed) throw new Error("Recording cancelled");
		const ready = this.wait("ready", 5000);
		const child = this.child = spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
		let pending = Buffer.alloc(0);
		let stderr = "";
		child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-2048); });
		child.stdin.on("error", () => this.fail(new Error("Microphone helper input closed")));
		child.on("error", error => this.fail(new Error(`Cannot start microphone helper: ${error.message}`)));
		child.on("exit", () => this.fail(new Error(`Microphone helper exited${stderr.trim() ? `: ${stderr.trim()}` : ""}`)));
		child.stdout.on("data", (chunk: Buffer) => {
			if (this.closed) return;
			pending = Buffer.concat([pending, chunk]);
			let end: number;
			while ((end = pending.indexOf(10)) >= 0) {
				if (end > 512 * 1024) { this.fail(new Error("Microphone helper event too large")); return; }
				const line = pending.subarray(0, end);
				pending = pending.subarray(end + 1);
				try { this.receive(JSON.parse(line.toString())); }
				catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); return; }
			}
			if (pending.length > 512 * 1024) this.fail(new Error("Microphone helper event too large"));
		});
		const event = await ready;
		if (event.version !== 6) throw new Error(`Unsupported microphone helper protocol: ${event.version}`);
	}

	private receive(event: any): void {
		if (!event || typeof event.type !== "string") throw new Error("Invalid microphone helper event");
		if (event.type === "error") throw new Error(String(event.message ?? "Microphone error"));
		if (event.type === "pcm") {
			if (event.sample_rate !== 24000 || event.num_channels !== 1 || typeof event.audio !== "string" || event.audio.length > 65536 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.audio)) {
				throw new Error("Invalid microphone PCM format");
			}
			const pcm = Buffer.from(event.audio, "base64");
			if (pcm.length % 2) throw new Error("Incomplete microphone sample");
			this.onPcm(pcm);
		}
		this.waiters.get(event.type)?.resolve(event);
	}

	private send(command: object): void {
		if (this.closed || !this.child?.stdin.writable) throw new Error("Microphone helper is not running");
		this.child.stdin.write(JSON.stringify(command) + "\n");
	}

	start(inputDevice?: string): void {
		this.send({ type: "start_dictation", ...(inputDevice ? { microphone: inputDevice } : {}) });
	}

	async stop(): Promise<void> {
		const stopped = this.wait("stopped", 2000);
		try { this.send({ type: "stop" }); }
		catch (error) { this.waiters.get("stopped")?.reject(error as Error); }
		await stopped;
	}

	private fail(error: Error): void {
		if (this.closed) return;
		for (const waiter of this.waiters.values()) waiter.reject(error);
		this.onError(error);
		void this.close();
	}

	close(): Promise<void> {
		if (this.closing) return this.closing;
		this.closed = true;
		for (const waiter of this.waiters.values()) waiter.reject(new Error("Recording cancelled"));
		const child = this.child;
		this.child = undefined;
		this.closing = (async () => {
			if (!child || child.exitCode !== null || child.signalCode !== null) return;
			await new Promise<void>(resolve => {
				const terminate = setTimeout(() => child.kill("SIGTERM"), 1500);
				const kill = setTimeout(() => { child.kill("SIGKILL"); done(); }, 2500);
				const done = () => { clearTimeout(terminate); clearTimeout(kill); resolve(); };
				child.once("exit", done);
				if (child.stdin.writable) child.stdin.end('{"type":"shutdown"}\n');
				else child.kill("SIGTERM");
			});
		})();
		return this.closing;
	}
}
