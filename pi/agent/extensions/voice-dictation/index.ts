import { loadConfig } from "./config.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isKeyRelease, isKeyRepeat, matchesKey } from "@earendil-works/pi-tui";
import { DictationController, submitEditorDraft } from "./controller.ts";

const HOTKEY = "ctrl+alt+d";

export default function voiceDictation(pi: ExtensionAPI): void {
	const config = loadConfig();
	const dictation = new DictationController(config);
	let removeInputListener: (() => void) | undefined;

	pi.registerShortcut(HOTKEY, {
		description: "Toggle voice dictation",
		handler: ctx => dictation.toggle(ctx),
	});
	pi.registerCommand("dictate", {
		description: "Voice dictation: toggle, stop (transcribe), cancel (discard), or status",
		handler: async (args, ctx) => {
			switch (args.trim()) {
				case "": case "toggle": await dictation.toggle(ctx); break;
				case "stop": await dictation.finish(); break;
				case "cancel": await dictation.cancel(); break;
				case "status": ctx.ui.notify(`Dictation: ${dictation.state} · Ctrl+Alt+D · microphone: ${config.inputDevice || "system default"} · vocabulary: ${config.vocabulary.length} terms`, "info"); break;
				default: ctx.ui.notify("Use /dictate [toggle|stop|cancel|status]", "info");
			}
		},
	});
	pi.on("session_start", (_event, ctx) => {
		removeInputListener?.();
		if (ctx.mode === "tui") {
			removeInputListener = ctx.ui.onTerminalInput(data => {
				if (matchesKey(data, HOTKEY) && (isKeyRepeat(data) || isKeyRelease(data))) return { consume: true };
				if (matchesKey(data, "enter") && dictation.handleEnter(
					recordingCtx => submitEditorDraft(recordingCtx, (text, options) => pi.sendUserMessage(text, options)),
					isKeyRepeat(data) || isKeyRelease(data),
				)) return { consume: true };
				return undefined;
			});
		}
	});
	pi.on("session_shutdown", async () => {
		removeInputListener?.();
		removeInputListener = undefined;
		await dictation.cancel();
	});
}
