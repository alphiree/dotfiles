import { CURSOR_MARKER, Editor, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { sanitizeDisplay } from "./terminal-text.ts";

/** Keep the editing buffer/submit value intact; only the terminal view is filtered.
 * Editor.render() normally embeds buffer text verbatim between its own styles.
 */
export class SafeEditor extends Editor {
	private displayScroll = 0;

	override render(width: number): string[] {
		// Update Editor's wrapping width for keyboard navigation. Its output is
		// deliberately discarded: filtering styled output would trust injected SGR.
		super.render(width);
		const rawLines = this.getLines();
		const cursor = this.getCursor();
		const offset = rawLines.slice(0, cursor.line).reduce((n, line) => n + line.length + 1, 0) + cursor.col;
		const safe = sanitizeDisplay(rawLines.join("\n"), offset);
		const before = safe.text.slice(0, safe.cursor);
		const after = safe.text.slice(safe.cursor);
		const grapheme = after && !after.startsWith("\n")
			? new Intl.Segmenter().segment(after)[Symbol.iterator]().next().value?.segment ?? " "
			: " ";
		const consumed = after && !after.startsWith("\n") ? grapheme.length : 0;
		// This marker and inverse-video SGR belong to the editor, never the buffer.
		const marker = CURSOR_MARKER;
		const styled = `${before}${marker}\x1b[7m${grapheme}\x1b[0m${after.slice(consumed)}`;
		const lines = wrapTextWithAnsi(styled, Math.max(1, width - 1));
		const cursorLine = Math.max(0, lines.findIndex((line) => line.includes(marker)));
		const height = Math.max(5, Math.floor(this.tui.terminal.rows * 0.3));
		this.displayScroll = Math.max(0, Math.min(this.displayScroll, lines.length - height));
		if (cursorLine < this.displayScroll) this.displayScroll = cursorLine;
		if (cursorLine >= this.displayScroll + height) this.displayScroll = cursorLine - height + 1;
		const visible = lines.slice(this.displayScroll, this.displayScroll + height);
		return [
			this.renderTopBorder(width, this.displayScroll),
			...visible.map((line) => this.focused ? line : line.replaceAll(marker, "")),
			this.renderBottomBorder(width, Math.max(0, lines.length - this.displayScroll - visible.length)),
		];
	}
}
