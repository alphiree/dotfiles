// Authentication contract adapted from pi-codex-conversion 3.0.35.
// Read resolved Pi credentials; never read/write auth.json or register a provider.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface VoiceAuth { headers: Record<string, string>; env?: Record<string, string> }

export function authHeaders(token: string, sessionId: string, extra: Record<string, string | null> = {}): Record<string, string> {
	let account: unknown;
	try {
		const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
		account = payload["https://api.openai.com/auth"]?.chatgpt_account_id;
	} catch { /* Never include credentials in an error. */ }
	if (typeof account !== "string" || !account) throw new Error("Codex account ID missing; use /login openai-codex");
	const headers = new Headers();
	for (const [key, value] of Object.entries(extra)) if (value !== null) headers.set(key, value);
	headers.set("authorization", `Bearer ${token}`);
	headers.set("chatgpt-account-id", account);
	headers.set("originator", "pi");
	headers.set("x-session-id", sessionId);
	// Keep the working upstream voice handshake identity.
	headers.set("user-agent", "pi-codex-conversion");
	headers.delete("openai-beta");
	return Object.fromEntries(headers.entries());
}

export async function resolveVoiceAuth(ctx: ExtensionContext): Promise<VoiceAuth> {
	const resolved = await ctx.modelRegistry.getProviderAuth("openai-codex");
	if (!resolved?.auth.apiKey) throw new Error("Log into OpenAI Codex in Pi before starting dictation");
	const url = new URL(resolved.auth.baseUrl ?? "https://chatgpt.com/backend-api/codex");
	if (url.protocol !== "https:" || url.hostname !== "chatgpt.com" || !/^\/backend-api(?:\/codex)?\/?$/.test(url.pathname)) {
		throw new Error("Dictation requires the official Codex login, not a custom provider endpoint");
	}
	return {
		headers: authHeaders(resolved.auth.apiKey, ctx.sessionManager.getSessionId(), resolved.auth.headers),
		env: resolved.env,
	};
}
