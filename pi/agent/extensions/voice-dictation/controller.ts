import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveVoiceAuth, type VoiceAuth } from "./auth.ts";
import { Recorder } from "./recorder.ts";
import { Transcriber } from "./transcriber.ts";
import { InputMeter, type InputLevel } from "./input-level.ts";

export const STATUS_KEY = "voice-dictation";
type RecorderPort = Pick<Recorder, "open" | "start" | "stop" | "close">;
type TranscriberPort = Pick<Transcriber, "open" | "append" | "finish" | "close">;
export interface Dependencies {
	authenticate(ctx: ExtensionContext): Promise<VoiceAuth>;
	recorder(onPcm: (pcm: Buffer) => void, onError: (error: Error) => void): RecorderPort;
	transcriber(onError: (error: Error) => void): TranscriberPort;
}
interface Run {
	ctx: ExtensionContext;
	phase: "connecting" | "recording" | "transcribing" | "closing";
	meter: InputMeter;
	recorder?: RecorderPort;
	transcriber?: TranscriberPort;
	closing?: Promise<void>;
}
const defaults: Dependencies = {
	authenticate: resolveVoiceAuth,
	recorder: (pcm, error) => new Recorder(pcm, error),
	transcriber: error => new Transcriber(error),
};

export class DictationController {
	private active?: Run;
	private deps: Dependencies;
	private inputDevice?: string;
	constructor(inputDevice?: string, deps: Dependencies = defaults) {
		this.inputDevice = inputDevice;
		this.deps = deps;
	}
	get state(): string { return this.active?.phase ?? "idle"; }

	async toggle(ctx: ExtensionContext): Promise<void> {
		if (!ctx.hasUI) throw new Error("Dictation needs an interactive Pi editor");
		const current = this.active;
		if (current) {
			if (current.phase === "recording") await this.finish();
			else if (current.phase === "connecting") await this.cancel();
			return;
		}
		const run: Run = { ctx, phase: "connecting", meter: new InputMeter() };
		this.active = run;
		this.render(run);
		try {
			const auth = await this.deps.authenticate(ctx);
			if (!this.isCurrent(run)) return;
			const onError = (error: Error) => { void this.fail(run, error); };
			run.transcriber = this.deps.transcriber(onError);
			run.recorder = this.deps.recorder(pcm => {
				if (!this.isCurrent(run)) return;
				// stop() drains the final audio frames before committing the transcript.
				run.transcriber?.append(pcm);
				if (run.phase === "recording") {
					const level = run.meter.append(pcm);
					if (level) this.render(run, level);
				}
			}, onError);
			await run.recorder.open();
			if (!this.isCurrent(run)) return;
			await run.transcriber.open(auth);
			if (!this.isCurrent(run)) return;
			run.phase = "recording";
			run.recorder.start(this.inputDevice);
			this.render(run);
		} catch (error) {
			await this.fail(run, error);
		}
	}

	async finish(): Promise<void> {
		const run = this.active;
		if (!run || run.phase !== "recording") return;
		run.phase = "transcribing";
		this.render(run);
		try {
			await run.recorder!.stop();
			if (!this.isCurrent(run)) return;
			const text = await run.transcriber!.finish();
			if (!this.isCurrent(run)) return;
			if (text) run.ctx.ui.pasteToEditor(text);
			else run.ctx.ui.notify("No speech transcribed", "info");
			await this.close(run);
		} catch (error) {
			await this.fail(run, error);
		}
	}

	async cancel(): Promise<void> { if (this.active) await this.close(this.active); }

	private isCurrent(run: Run): boolean {
		return this.active === run && run.phase !== "closing";
	}

	private render(run: Run, level?: InputLevel): void {
		if (!this.isCurrent(run)) return;
		const theme = run.ctx.ui.theme;
		const waveform = level ? ` · mic ${level.waveform}${level.clipping ? " clipping risk" : ""}` : "";
		run.ctx.ui.setStatus(STATUS_KEY,
			theme.fg("accent", `voice: ${run.phase}`) + theme.fg(level?.clipping ? "warning" : "dim", waveform));
	}

	private async fail(run: Run, error: unknown): Promise<void> {
		if (!this.isCurrent(run)) return;
		run.ctx.ui.notify(error instanceof Error ? error.message : "Dictation failed", "error");
		await this.close(run);
	}

	private close(run: Run): Promise<void> {
		if (run.closing) return run.closing;
		run.phase = "closing";
		run.ctx.ui.setStatus(STATUS_KEY, undefined);
		run.closing = Promise.allSettled([run.recorder?.close(), run.transcriber?.close()]).then(() => {
			if (this.active === run) this.active = undefined;
		});
		return run.closing;
	}
}
