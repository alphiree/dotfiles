import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import childProcess from "node:child_process";
import { realpathSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { syncBuiltinESMExports } from "node:module";

// Use Pi's actual TypeScript/extension loader; no test dependencies or model calls.
const piRoot = process.env.PI_PACKAGE_DIR || dirname(dirname(realpathSync(childProcess.execFileSync("which", ["pi"], { encoding: "utf8" }).trim())));
const { loadExtensions } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));
const loaded = await loadExtensions([extensionPath], process.cwd());
assert.deepEqual(loaded.errors, []);
const tool = loaded.extensions[0].tools.get("video_extract").definition;
const id = "0Rp9KJCEIvg";
let calls;
let respond;
const png = Buffer.from("89504e470d0a1a0a", "hex");
const context = new Proxy({}, { get() { throw new Error("Must not access model registry/auth or other session state"); } });
const execute = (args, signal) => tool.execute("test", { url: id, ...args }, signal, undefined, context);
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");

mock.method(childProcess, "execFile", (command, args, options, callback) => {
	calls.push({ command, args, options });
	queueMicrotask(async () => {
		try {
			const output = await respond(command, args, options);
			callback(null, Buffer.isBuffer(output) ? output : Buffer.from(output), Buffer.alloc(0));
		} catch (error) {
			callback(error, Buffer.alloc(0), Buffer.from(error.stderr || ""));
		}
	});
});
syncBuiltinESMExports();
after(() => { mock.restoreAll(); syncBuiltinESMExports(); });

function defaults(command) {
	if (command === process.execPath) return "[0:00] Hello world\n[3:00] Trust and authentication";
	if (command === "yt-dlp") return JSON.stringify({ duration: 400, url: "https://media.example/video", is_live: false });
	if (command === "ffmpeg") return png;
	throw new Error(`Unexpected command: ${command}`);
}
beforeEach(() => { calls = []; respond = defaults; });

test("schema removes Gemini fields and local files, exposes optional thumbnail", () => {
	assert.equal(tool.parameters.additionalProperties, false);
	assert.equal(tool.parameters.properties.prompt, undefined);
	assert.equal(tool.parameters.properties.model, undefined);
	assert.equal(tool.parameters.properties.thumbnail.type, "boolean");
	assert.equal(tool.parameters.properties.frames.maximum, 12);
});

test("URL-only defaults to the existing caption script, with no images or auth", async () => {
	const result = await execute({ url: `https://youtu.be/${id}?si=tracking` });
	assert.equal(result.details.transcriptStatus, "available");
	assert.equal(result.details.imageCount, 0);
	assert.match(text(result), /\[3:00\] Trust/);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].command, process.execPath);
	assert.equal(calls[0].args[0], resolve(dirname(extensionPath), "../../skills/youtube-transcript/transcript.js"));
	assert.deepEqual(calls[0].args.slice(1), [`https://www.youtube.com/watch?v=${id}`, "--max-chars", "30000"]);
});

test("caption language and character cap are forwarded", async () => {
	await execute({ lang: "en", max_chars: 45000 });
	assert.deepEqual(calls[0].args.slice(-4), ["--max-chars", "45000", "--lang", "en"]);
});

test("missing captions are a limitation, not an invented transcript", async () => {
	respond = () => { throw new Error("Captions are unavailable for this video."); };
	const result = await execute({});
	assert.equal(result.details.transcriptStatus, "unavailable");
	assert.match(text(result), /Limitation: speech is unavailable/);
	assert.match(text(result), /does not transcribe audio/);
});

test("empty captions are also unavailable", async () => {
	respond = () => "";
	assert.equal((await execute({})).details.transcriptStatus, "unavailable");
});

test("rate limits are not mislabeled as absent subtitles", async () => {
	respond = () => { throw new Error("YouTube rate-limited caption retrieval."); };
	await assert.rejects(execute({}), /rate-limited/);
});

test("single timestamp extracts only the requested frame", async () => {
	const result = await execute({ timestamp: "3:00" });
	assert.deepEqual(calls.map((c) => c.command), ["yt-dlp", "ffmpeg"]);
	assert.equal(calls[1].args[calls[1].args.indexOf("-ss") + 1], "180");
	assert.equal(result.details.frameCount, 1);
	assert.equal(result.content.find((c) => c.type === "image").mimeType, "image/png");
	assert.match(text(result), /Video frame at 3:00/);
});

test("short ranges honor requested density, not the old 5-second minimum", async () => {
	const result = await execute({ timestamp: "2:58-3:03", frames: 4 });
	const times = calls.filter((c) => c.command === "ffmpeg").map((c) => c.args[c.args.indexOf("-ss") + 1]);
	assert.deepEqual(times, ["178", "179.667", "181.333", "183"]);
	assert.equal(result.details.frameCount, 4);
	assert.match(text(result), /2:59.667/);
});

test("single timestamp with count retains 5-second spacing", async () => {
	await execute({ timestamp: "3:00", frames: 3 });
	assert.deepEqual(calls.filter((c) => c.command === "ffmpeg").map((c) => c.args[c.args.indexOf("-ss") + 1]), ["180", "185", "190"]);
});

test("full-video sampling never seeks exactly to EOF", async () => {
	const result = await execute({ frames: 3 });
	const times = calls.filter((c) => c.command === "ffmpeg").map((c) => Number(c.args[c.args.indexOf("-ss") + 1]));
	assert.equal(result.details.frameCount, 3);
	assert.deepEqual(times, [0, 199.95, 399.9]);
});

test("thumbnail-only fetch is opt-in and explicitly labeled, without captions/yt-dlp", async () => {
	const result = await execute({ thumbnail: true });
	assert.equal(calls.length, 1);
	assert.equal(calls[0].command, "ffmpeg");
	assert.ok(calls[0].args.includes(`https://img.youtube.com/vi/${id}/hqdefault.jpg`));
	assert.equal(result.details.thumbnailIncluded, true);
	assert.equal(result.details.frameCount, 0);
	assert.match(text(result), /Promotional YouTube thumbnail — NOT a timestamped video frame/);
});

test("captions, frames, and thumbnail can be combined", async () => {
	const result = await execute({ transcript: true, timestamp: "180", thumbnail: true });
	assert.equal(result.details.transcriptStatus, "available");
	assert.equal(result.details.frameCount, 1);
	assert.equal(result.details.thumbnailIncluded, true);
	assert.equal(result.details.imageCount, 2);
});

test("caption retrieval failure preserves requested visuals and warns about speech", async () => {
	respond = (command) => {
		if (command === process.execPath) throw new Error("YouTube rate-limited caption retrieval.");
		return defaults(command);
	};
	const result = await execute({ transcript: true, timestamp: "180" });
	assert.equal(result.details.transcriptStatus, "error");
	assert.equal(result.details.frameCount, 1);
	assert.match(text(result), /Limitation: speech is unavailable/);
	assert.match(text(result), /rate-limited/);
});

test("partial frame failures are visible rather than silently dropped", async () => {
	respond = (command, args) => {
		if (command === "ffmpeg" && args.includes("185")) throw new Error("Stream URL returned 403");
		return defaults(command);
	};
	const result = await execute({ timestamp: "180", frames: 3 });
	assert.equal(result.details.frameCount, 2);
	assert.match(text(result), /Frame at 3:05: Stream URL returned 403/);
});

test("thumbnail failure does not discard captions", async () => {
	respond = (command) => {
		if (command === "ffmpeg") throw new Error("HTTP 404");
		return defaults(command);
	};
	const result = await execute({ transcript: true, thumbnail: true });
	assert.equal(result.details.transcriptStatus, "available");
	assert.equal(result.details.thumbnailIncluded, false);
	assert.match(text(result), /Thumbnail: HTTP 404/);
});

test("rejects local paths, unrelated URLs, spoofed hosts, and unsupported protocols before I/O", async () => {
	for (const url of ["/tmp/video.mp4", "./video.mp4", "file:///tmp/video.mp4", `https://youtube.com.evil.test/watch?v=${id}`, `https://evil.test/?url=youtu.be/${id}`, `ftp://youtube.com/watch?v=${id}`, "https://youtube.com/playlist?list=123"]) {
		await assert.rejects(execute({ url }), /Only YouTube/);
	}
	assert.equal(calls.length, 0);
});

test("accepts standard YouTube URL forms", async () => {
	for (const url of [`https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`, `https://youtube.com/live/${id}`]) {
		assert.equal((await execute({ url })).details.url, `https://www.youtube.com/watch?v=${id}`);
	}
});

test("rejects malformed/nonfinite/reversed timestamps and invalid counts before I/O", async () => {
	for (const timestamp of ["", "Infinity", "NaN", "-1", "3:70", "3:00-2:00", "3:00-4:00-5:00"]) {
		await assert.rejects(execute({ timestamp }));
	}
	for (const frames of [0, 13, 1.5]) await assert.rejects(execute({ timestamp: "180", frames }), /frames must/);
	assert.equal(calls.length, 0);
});

test("no-op request is rejected", async () => {
	await assert.rejects(execute({ transcript: false }), /Request captions, frames, or a thumbnail/);
	assert.equal(calls.length, 0);
});

test("out-of-bounds timestamps do not launch ffmpeg", async () => {
	await assert.rejects(execute({ timestamp: "400" }), /before the end/);
	assert.equal(calls.length, 1);
});

test("unknown duration needs an explicit timestamp, and active live streams fail clearly", async () => {
	respond = (command) => command === "yt-dlp" ? JSON.stringify({ url: "https://media.example/video", duration: null }) : defaults(command);
	await assert.rejects(execute({ frames: 2 }), /duration unavailable/);
	assert.equal((await execute({ timestamp: "3:00" })).details.frameCount, 1);
	respond = () => JSON.stringify({ is_live: true });
	await assert.rejects(execute({ frames: 2 }), /Active live streams/);
});

test("missing executables and empty image output fail clearly", async () => {
	respond = () => { throw Object.assign(new Error("spawn"), { code: "ENOENT" }); };
	await assert.rejects(execute({ frames: 1 }), /yt-dlp is not installed/);
	respond = (command) => command === "ffmpeg" ? Buffer.alloc(0) : defaults(command);
	await assert.rejects(execute({ timestamp: "180" }), /ffmpeg returned no image/);
});

test("cancellation before work performs no I/O", async () => {
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(execute({}, controller.signal), /abort/i);
	assert.equal(calls.length, 0);
});

test("cancellation reaches subprocesses and is never converted into a caption limitation", async () => {
	const controller = new AbortController();
	respond = (_command, _args, options) => {
		assert.equal(options.signal, controller.signal);
		controller.abort();
		return "Captions are unavailable";
	};
	await assert.rejects(execute({}, controller.signal), /abort/i);
});

test("large UTF-8 caption output is capped and the remainder is readable from disk", async () => {
	const full = "[0:00] 字".repeat(7000);
	respond = () => full;
	const result = await execute({ max_chars: 50000 });
	assert.equal(result.details.transcriptTruncated, true);
	assert.ok(Buffer.byteLength(text(result), "utf8") < 50 * 1024);
	assert.match(text(result), /Display truncated/);
	assert.equal(await readFile(result.details.captionOutputPath, "utf8"), full);
	await rm(dirname(result.details.captionOutputPath), { recursive: true, force: true });
});

test("script's own truncation notice remains visible", async () => {
	respond = () => "[0:00] First words\n[Transcript truncated after 30 characters; 100 later segment(s) omitted.]";
	const result = await execute({});
	assert.equal(result.details.transcriptTruncated, true);
	assert.match(text(result), /100 later segment\(s\) omitted/);
});
