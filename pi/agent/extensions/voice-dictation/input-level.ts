// Adapted from our local pi-codex-conversion waveform patch.
export interface InputLevel { waveform: string; clipping: boolean }
const BARS = "▁▂▃▄▅▆▇█";

export class InputMeter {
	private history = "▁".repeat(20);
	private last = -Infinity;
	private energy = 0;
	private samples = 0;
	private peak = 0;

	// Aggregate all frames between redraws so short peaks aren't lost.
	append(pcm: Buffer, now = Date.now()): InputLevel | undefined {
		if (!pcm.length || pcm.length % 2) return;
		for (let i = 0; i < pcm.length; i += 2) {
			const sample = pcm.readInt16LE(i);
			this.energy += sample * sample;
			this.peak = Math.max(this.peak, Math.abs(sample));
			this.samples++;
		}
		if (now - this.last < 125) return;
		const rms = Math.sqrt(this.energy / this.samples);
		const db = 20 * Math.log10(Math.max(rms / 32768, 0.000001));
		const bar = BARS[Math.max(0, Math.min(7, Math.round((db + 60) / 60 * 7)))];
		this.history = this.history.slice(1) + bar;
		const level = { waveform: `[${this.history}]`, clipping: this.peak >= 32112 };
		this.last = now;
		this.energy = this.samples = this.peak = 0;
		return level;
	}
}
