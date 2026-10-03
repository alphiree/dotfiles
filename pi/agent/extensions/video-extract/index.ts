import { truncateHead, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the installed skill, including its dependency and caption error handling.
const TRANSCRIPT_SCRIPT = fileURLToPath(new URL("../../skills/youtube-transcript/transcript.js", import.meta.url));
const MAX_FRAMES = 12;

export function youtubeId(input: string): string {
	if (/^[\w-]{11}$/.test(input)) return input;
	try {
		const url = new URL(input);
		if (!["http:", "https:"].includes(url.protocol)) throw new Error();
		const host = url.hostname.toLowerCase();
		const parts = url.pathname.split("/").filter(Boolean);
		const id = host === "youtu.be" ? parts[0]
			: (host === "youtube.com" || host.endsWith(".youtube.com"))
				? url.pathname === "/watch" ? url.searchParams.get("v")
					: ["shorts", "live", "embed", "v"].includes(parts[0]) ? parts[1] : null
				: null;
		if (id && /^[\w-]{11}$/.test(id)) return id;
	} catch { /* Give one clear error for unsupported inputs. */ }
	throw new Error("Only YouTube video URLs or 11-character video IDs are supported. Local files are not supported.");
}

function seconds(value: string): number {
	if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(value)) throw new Error("Invalid timestamp.");
	const parts = value.split(":").map(Number);
	if (parts.slice(1).some((part) => part >= 60)) throw new Error("Timestamp minutes/seconds must be below 60.");
	const result = parts.reduce((total, part) => total * 60 + part, 0);
	if (!Number.isFinite(result)) throw new Error("Invalid timestamp.");
	return result;
}

export function formatTimestamp(value: number): string {
	const milliseconds = Math.round(value * 1000);
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const remainder = String(totalSeconds % 60).padStart(2, "0");
	const fraction = milliseconds % 1000 ? `.${String(milliseconds % 1000).padStart(3, "0").replace(/0+$/, "")}` : "";
	return `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : minutes}:${remainder}${fraction}`;
}

export function frameTimes(timestamp?: string, count?: number, duration?: number): number[] {
	if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > MAX_FRAMES)) {
		throw new Error(`frames must be an integer between 1 and ${MAX_FRAMES}.`);
	}
	let start: number;
	let end: number;
	let total = count ?? 6;
	if (timestamp !== undefined) {
		const parts = timestamp.trim().split("-").map((part) => part.trim());
		if (parts.length > 2) throw new Error("Invalid timestamp range.");
		start = seconds(parts[0]);
		if (parts.length === 2) {
			end = seconds(parts[1]);
			if (end <= start) throw new Error("Timestamp range end must be after its start.");
		} else {
			total = count ?? 1;
			end = start + (total - 1) * 5;
		}
		if (duration !== undefined && end >= duration) throw new Error("Timestamp must be before the end of the video.");
	} else {
		if (duration === undefined || duration <= 0) throw new Error("Video duration unavailable. Use an explicit timestamp or range.");
		start = 0;
		end = Math.max(0, duration - 0.1); // Seeking exactly to EOF returns no frame.
	}
	return [...new Set(Array.from({ length: total }, (_, i) =>
		Number((start + (total === 1 ? 0 : i * (end - start) / (total - 1))).toFixed(3))))];
}

function run(command: string, args: string[], signal?: AbortSignal, timeout = 45000): Promise<Buffer> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		execFile(command, args, { encoding: "buffer", maxBuffer: 8 * 1024 * 1024, timeout, signal }, (error, stdout, stderr) => {
			if (signal?.aborted) return reject(new Error("Cancelled"));
			if (error) {
				const reason = (error as NodeJS.ErrnoException).code === "ENOENT"
					? `${command} is not installed or not on PATH.`
					: error.killed ? `${command} timed out.` : (stderr.toString().trim() || error.message).slice(0, 800);
				return reject(new Error(reason));
			}
			resolve(stdout);
		});
	});
}

async function png(input: string, signal?: AbortSignal, timestamp?: number): Promise<ImageContent> {
	const data = await run("ffmpeg", [
		"-nostdin", "-v", "error",
		...(timestamp === undefined ? [] : ["-ss", String(timestamp)]),
		"-i", input, "-frames:v", "1",
		"-vf", "scale=w='min(1920,iw)':h=-1",
		"-f", "image2pipe", "-vcodec", "png", "pipe:1",
	], signal);
	if (!data.length) throw new Error("ffmpeg returned no image.");
	// PNG is compatible with Pi's terminal image renderer (including Kitty).
	return { type: "image", data: data.toString("base64"), mimeType: "image/png" };
}

const parameters = Type.Object({
	url: Type.String({ description: "YouTube URL or video ID. Local files are not supported." }),
	transcript: Type.Optional(Type.Boolean({ description: "Fetch YouTube captions via the transcript skill. Defaults to true unless timestamp, frames, or thumbnail is requested. Set true to combine captions with images." })),
	timestamp: Type.Optional(Type.String({ description: "Frame at seconds, MM:SS, or H:MM:SS (decimals allowed), or a start-end range. A range samples 6 evenly spaced frames by default; with a single timestamp, frames uses 5-second spacing." })),
	frames: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_FRAMES, description: "Frame count. Alone: sample across the video. With a range: evenly spaced, including dense short ranges. With a single timestamp: every 5 seconds." })),
	thumbnail: Type.Optional(Type.Boolean({ description: "Fetch the promotional thumbnail (default false). Not a frame from the video; use only when relevant." })),
	lang: Type.Optional(Type.String({ minLength: 1, description: "Preferred caption language code, e.g. en. Does not translate captions." })),
	max_chars: Type.Optional(Type.Integer({ minimum: 1, maximum: 50000, description: "Caption character cap, default 30000; omissions are explicitly reported." })),
}, { additionalProperties: false });

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "video_extract",
		label: "YouTube Extract",
		description: "Retrieve YouTube captions, timestamped frames, and optional promotional thumbnails for the current assistant to analyze. No separate AI/API key or audio transcription. Captions reuse the youtube-transcript skill; frames require yt-dlp + ffmpeg, thumbnails require ffmpeg. Captions default to 30000 characters (max 50000); returned caption text also caps at 1900 lines/40KB with overflow saved to a file. Missing captions are an explicit speech-analysis limitation. YouTube only.",
		promptSnippet: "Retrieve YouTube captions and optional frames/thumbnails; analyze the returned evidence yourself.",
		promptGuidelines: [
			"Use video_extract with just url for spoken-content summaries. It reuses the youtube-transcript skill; do not fetch the same captions twice.",
			"Use video_extract timestamp/frames for visuals; set transcript:true to include captions in the same call. Sampled frames do not capture all motion or audio.",
			"Use video_extract thumbnail:true only when promotional imagery matters; a thumbnail is not evidence of events inside the video.",
			"If video_extract reports missing captions or retrieval failures, state that speech is unavailable. Never invent speech from frames, thumbnails, or truncated captions.",
		],
		parameters,
		async execute(_id, params, signal, onUpdate) {
			signal?.throwIfAborted();
			const videoId = youtubeId(params.url.trim());
			const url = `https://www.youtube.com/watch?v=${videoId}`;
			const wantFrames = params.timestamp !== undefined || params.frames !== undefined;
			const wantTranscript = params.transcript ?? !(wantFrames || params.thumbnail);
			if (!wantTranscript && !wantFrames && !params.thumbnail) throw new Error("Request captions, frames, or a thumbnail.");
			// Validate explicit timestamps before doing any network I/O.
			if (params.timestamp !== undefined) frameTimes(params.timestamp, params.frames);
			onUpdate?.({ content: [{ type: "text", text: "Retrieving YouTube evidence…" }], details: {} });

			const content: (TextContent | ImageContent)[] = [{ type: "text", text: `Source: ${url}` }];
			const warnings: string[] = [];
			let transcriptStatus = "not_requested";
			let transcriptTruncated = false;
			let captionOutputPath: string | undefined;
			let imageCount = 0;
			let frameCount = 0;
			let thumbnailIncluded = false;
			const report = (label: string, error: unknown) => {
				signal?.throwIfAborted();
				warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
			};

			if (wantTranscript) {
				try {
					const args = [TRANSCRIPT_SCRIPT, url, "--max-chars", String(params.max_chars ?? 30000)];
					if (params.lang) args.push("--lang", params.lang);
					const text = (await run(process.execPath, args, signal)).toString("utf8").trim();
					if (!text) throw new Error("Captions are unavailable: no caption text was returned.");
					const limited = truncateHead(text, { maxLines: 1900, maxBytes: 40 * 1024 });
					transcriptTruncated = limited.truncated || text.includes("[Transcript truncated");
					let notice = "";
					if (limited.truncated) {
						const dir = await mkdtemp(join(tmpdir(), "pi-youtube-captions-"));
						captionOutputPath = join(dir, "captions.txt");
						await writeFile(captionOutputPath, text, "utf8");
						notice = `\n[Display truncated. Caption script output saved to ${captionOutputPath}; read it for the remaining output. The script's character cap still applies.]`;
					}
					content.push({ type: "text", text: `YouTube captions (may be auto-generated/inaccurate; not independently verified):\n${limited.content}${notice}` });
					transcriptStatus = "available";
				} catch (error) {
					transcriptStatus = /Captions are unavailable/i.test(String(error)) ? "unavailable" : "error";
					report("Captions", error);
				}
			}

			if (wantFrames) {
				try {
					const raw = await run("yt-dlp", [
						"--ignore-config", "--no-playlist", "--no-warnings", "--skip-download",
						"-f", "bestvideo[height<=1080]/best[height<=1080]/bestvideo/best",
						"--print", '{"duration":%(duration)j,"url":%(url)j,"is_live":%(is_live)j}', url,
					], signal);
					const info = JSON.parse(raw.toString("utf8"));
					if (info.is_live === true) throw new Error("Active live streams are not supported.");
					if (typeof info.url !== "string" || !/^https?:\/\//.test(info.url)) throw new Error("yt-dlp returned no usable video stream URL.");
					const duration = typeof info.duration === "number" && Number.isFinite(info.duration) && info.duration > 0 ? info.duration : undefined;
					const times = frameTimes(params.timestamp, params.frames, duration);
					// Sequential extraction keeps subprocess and memory usage bounded.
					for (const time of times) {
						try {
							const image = await png(info.url, signal, time);
							content.push({ type: "text", text: `Video frame at ${formatTimestamp(time)}` }, image);
							imageCount++;
							frameCount++;
						} catch (error) { report(`Frame at ${formatTimestamp(time)}`, error); }
					}
				} catch (error) { report("Frames", error); }
			}

			if (params.thumbnail) {
				try {
					const image = await png(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, signal);
					content.push({ type: "text", text: "Promotional YouTube thumbnail — NOT a timestamped video frame or proof of video events." }, image);
					imageCount++;
					thumbnailIncluded = true;
				} catch (error) { report("Thumbnail", error); }
			}

			signal?.throwIfAborted();
			if (wantTranscript && transcriptStatus !== "available") {
				content.push({ type: "text", text: "Limitation: speech is unavailable because captions could not be retrieved. This tool does not transcribe audio. Any returned images support visual inspection only; do not infer spoken content from them." });
			}
			if (!imageCount && transcriptStatus !== "available" && transcriptStatus !== "unavailable") {
				throw new Error(warnings.join("\n") || "No evidence retrieved.");
			}
			if (warnings.length) content.push({ type: "text", text: warnings.join("\n") });
			return { content, details: { url, transcriptStatus, transcriptTruncated, captionOutputPath, imageCount, frameCount, thumbnailIncluded, warnings } };
		},
	});
}
