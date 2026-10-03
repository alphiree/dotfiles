import { readFileSync } from "node:fs";

export interface DictationConfig {
	inputDevice?: string;
	vocabulary: string[];
}

function invalid(reason: string): never {
	throw new Error(`voice-dictation/config.json: ${reason}`);
}

export function parseConfig(value: unknown): DictationConfig {
	if (!value || typeof value !== "object" || Array.isArray(value)) invalid("must be a JSON object");
	const config = value as Record<string, unknown>;
	if (config.inputDevice !== undefined && typeof config.inputDevice !== "string") invalid("inputDevice must be a string");
	const words = config.vocabulary === undefined ? [] : config.vocabulary;
	if (!Array.isArray(words) || words.length > 32) invalid("vocabulary must be an array of at most 32 terms");
	const vocabulary: string[] = [];
	const seen = new Set<string>();
	for (const word of words) {
		if (typeof word !== "string" || !word.trim() || word.length > 64 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(word)) {
			invalid("each vocabulary term must be nonempty, single-line text of at most 64 characters");
		}
		const term = word.trim();
		if (!seen.has(term.toLowerCase())) {
			seen.add(term.toLowerCase());
			vocabulary.push(term);
		}
	}
	if (vocabulary.join(", ").length > 1024) invalid("combined vocabulary must be at most 1024 characters");
	return { inputDevice: (config.inputDevice as string | undefined)?.trim() || undefined, vocabulary };
}

export function loadConfig(path: URL = new URL("./config.json", import.meta.url)): DictationConfig {
	let text: string;
	try { text = readFileSync(path, "utf8"); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { vocabulary: [] };
		invalid("could not read configuration");
	}
	let value: unknown;
	try { value = JSON.parse(text); }
	catch { invalid("invalid JSON"); }
	return parseConfig(value);
}

export function vocabularyPrompt(vocabulary: readonly string[]): string | undefined {
	return vocabulary.length ? `Relevant names and technical terms: ${vocabulary.join(", ")}.` : undefined;
}
