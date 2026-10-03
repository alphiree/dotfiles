/** Display-only ECMA-48 filter. Never apply this to stored answers/option values.
 * Strip control strings through ST (OSC also accepts BEL), including incomplete
 * strings through EOF. CSI and ESC sequences are consumed, not just their ESC.
 * Keep LF, expand TAB, normalize CRLF, and remove all other C0/C1 controls.
 */
export function sanitizeDisplay(text: string, cursor = text.length): { text: string; cursor: number } {
	let output = "";
	let mappedCursor = 0;
	for (let i = 0; i < text.length;) {
		const start = i;
		const c = text.charCodeAt(i++);
		let introducer = c;
		if (c === 0x1b) introducer = text.charCodeAt(i++);
		const escaped = c === 0x1b;
		const osc = escaped ? introducer === 0x5d : c === 0x9d;
		const string = osc || (escaped
			? [0x50, 0x58, 0x5e, 0x5f].includes(introducer)
			: [0x90, 0x98, 0x9e, 0x9f].includes(c));
		if (string) {
			while (i < text.length) {
				const next = text.charCodeAt(i++);
				if (next === 0x9c || (osc && next === 0x07)) break;
				if (next === 0x1b && text.charCodeAt(i) === 0x5c) { i++; break; }
			}
		} else if (escaped ? introducer === 0x5b : c === 0x9b) {
			// Consume parameter/intermediate bytes and the final byte, if present.
			while (i < text.length && text.charCodeAt(i) >= 0x20 && text.charCodeAt(i) <= 0x3f) i++;
			if (i < text.length && text.charCodeAt(i) >= 0x40 && text.charCodeAt(i) <= 0x7e) i++;
		} else if (escaped) {
			// ESC intermediates (e.g. character-set selection), then final byte.
			if (introducer >= 0x20 && introducer <= 0x2f) {
				while (i < text.length && text.charCodeAt(i) >= 0x20 && text.charCodeAt(i) <= 0x2f) i++;
				if (i < text.length && text.charCodeAt(i) >= 0x30 && text.charCodeAt(i) <= 0x7e) i++;
			} else if (!(introducer >= 0x30 && introducer <= 0x7e)) {
				// Do not swallow another control introducer or legitimate Unicode.
				i = start + 1;
			}
		} else if (c === 0x0a) output += "\n";
		else if (c === 0x09) output += "    ";
		else if (c === 0x0d && text.charCodeAt(i) === 0x0a) { /* LF handled next */ }
		else if (c >= 0x20 && !(c >= 0x7f && c <= 0x9f)) output += text[start];
		if (i <= cursor) mappedCursor = output.length;
	}
	return { text: output, cursor: mappedCursor };
}

export function displayText(text: string | undefined): string {
	return sanitizeDisplay(text ?? "").text;
}
