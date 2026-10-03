# Local voice dictation

A manually maintained Pi extension. **Speak → review**, or **speak → Enter to send**.
No model tools, provider registration, prompt rewriting, realtime assistant,
LAN server, background recording, or separate API key.

## Use

- **Ctrl+Alt+D**: start recording; press again to stop and transcribe for review.
- **Enter while recording**: stop, finish transcription, and send the entire editor
  draft (including any existing typed text) to this Pi session. If the agent is
  busy, queue it as a steering message, like normal Enter. Enter also requests
  sending if transcription is already finishing. Repeated key events are ignored.
  Empty/failed transcription sends nothing; session switch/reload cancels pending
  submission. Unmodified Enter is intercepted only while dictation is active;
  Shift+Enter and normal idle editing keep their usual behavior.
- `/dictate`: the same toggle.
- `/dictate stop`: stop and transcribe an active recording.
- `/dictate cancel`: discard/cancel, including connection/transcription in progress.
- `/dictate status`: show state, configured microphone, and vocabulary term count.
- Wait for `voice: recording` before speaking.
- During recording, the footer displays a scrolling loudness history:
  `mic [▁▁▂▄▆█▅▃▂▁▁]`. Silence is normal; near-full-scale PCM shows
  `clipping risk`. This is not a frequency spectrum or recognition score.
- Shutdown, `/reload`, or switching sessions cancels recording and closes resources.

The transcript uses Pi's normal paste-into-editor behavior. Ctrl+Alt+D leaves it
editable; pressing Enter while dictating explicitly authorizes sending when
transcription finishes. No transcription cleanup/rewrite model is involved.

## Setup / configuration

This folder lives in `~/.pi/agent/extensions/voice-dictation` (symlinked into the
dotfiles checkout). Pi auto-discovers `index.ts`; no `pi install` is needed.
Node >=22.19 and Pi's `openai-codex` login are required.

On a fresh checkout:

```sh
cd ~/.pi/agent/extensions/voice-dictation
npm ci --ignore-scripts
# Optional: only copy if you do not already have a personal config.json.
cp -n config.json.example config.json
```

`config.json` is personal and Git-ignored; `config.json.example` is the shared
starting point. Without a config, dictation uses the helper's platform-default
microphone and no vocabulary hints. Invalid configuration produces an error
instead of silently ignoring your settings.

Set `inputDevice` to `alsa:pipewire` to follow the default PipeWire input on Linux,
or another native helper device ID to pin it. An empty string uses the helper's
platform default. Select your external/headset microphone in desktop sound settings.
Run `/reload` after config edits. The shortcut is a simple constant in `index.ts`.

### Personal vocabulary

Add a short `vocabulary` array of tool names, project names, or technical terms:

```json
{
  "inputDevice": "alsa:pipewire",
  "vocabulary": ["Pi", "Codex", "TypeScript"]
}
```

The extension builds a short recognition prompt once on load and includes it in
its existing transcription setup message. There is no extra network round trip,
context lookup, session scan, or second AI pass during dictation. Server-side
prompt processing may still affect latency; this has not been benchmarked live.

Keep only terms you actually dictate: excess hints can bias recognition toward
words you did not say. These are spelling hints, not guaranteed replacements.
Limits are 32 terms, 64 characters per term, and 1024 characters for the joined
list (local safeguards, not claimed API limits). Terms must be nonempty and
single-line; surrounding whitespace and case-insensitive duplicates are removed.
Set `"vocabulary": []` or omit it to restore the original prompt-free behavior.
No automatic learning or text replacement is performed.

## Dependencies and privacy

- The native `pi-codex-voice` helper captures 24 kHz mono PCM16LE. Only the existing
  Linux x64 binary is vendored; other platforms need the corresponding helper.
- One npm runtime dependency: `undici`, for authenticated WebSocket transport and
  HTTP(S) proxy handling. No imports from the old Codex conversion package.
- Auth is resolved via Pi's public `getProviderAuth("openai-codex")` API. This code
  does not read/write `auth.json`, change providers, or change the selected model.
- Audio streams to OpenAI at
  `wss://api.openai.com/v1/realtime?intent=transcription`, using the existing Codex
  login. The model is `gpt-4o-mini-transcribe`, with near-field noise reduction and
  explicit commit on stop, matching the previously working extension. Configured
  vocabulary is also sent to OpenAI as a transcription prompt; do not put secrets
  in it. Editor drafts, session history, and repository files are not read for
  transcription context.
- Account availability/limits and the subscription endpoint are controlled by
  OpenAI and may change. A Pro plan is not a guarantee of future endpoint access.
- No local audio files, token logging, transcript history, LAN listener, or second
  microphone capture. The waveform is calculated from the same outgoing PCM.
- Microphone capture and the network connection start only on an explicit toggle.
  The helper is opened before the socket, but capture starts only after the server
  acknowledges the transcription configuration.

## Maintenance

- `index.ts`: shortcut, commands, and Pi lifecycle.
- `config.ts`: optional personal configuration, validation, and vocabulary prompt.
- `controller.ts`: start/stop/cancel, editor insertion, status lifecycle.
- `auth.ts`: resolved Codex login headers.
- `recorder.ts`: bounded JSONL process bridge and cleanup.
- `transcriber.ts`: bounded transcription WebSocket protocol.
- `input-level.ts`: scrolling waveform and clipping indicator.

No build step and no generated JS copies. Edit these source files, run `npm test`,
then `/reload`. Tests exercise synthetic audio and fake connections: they do not
record the mic, contact OpenAI, or use real credentials. The test runner uses
Node's native TypeScript stripping (Node >=22.19).

## Migration / rollback

The `@howaboua/pi-codex-conversion@3.0.35` package was removed from Pi's configured
package list, not deleted from disk. The disabled older `codex-voice` experiment
also remains on disk. The unused agent-root files `codex-voice.json`,
`pi-codex-conversion.json`, and `REALTIME-SYSTEM-PROMPT.md` are removed during
migration; this extension does not read them. Its predecessor's `/codex` command and unused
voice/realtime/LAN shortcuts are intentionally not loaded. Dictation is now
`/dictate` or the unchanged Ctrl+Alt+D shortcut.

Do not enable both implementations at once: they share the dictation shortcut.
To roll back, first recreate the old package's voice-only configuration and
microphone settings; the removed legacy files are not retained here. Move this
directory under `~/.pi/agent/disabled-extensions/`, restore
`npm:@howaboua/pi-codex-conversion@3.0.35` to `settings.json`'s `packages`, then
restart Pi. The old installed version needs the local voice-only provider guard
if using the newer model catalog; reinstalling that package removes its patches.

## Attribution

Audio-helper protocol, Codex authentication/transcription contract, and native
helper adapted/reused from Igor Warzocha's `@howaboua/pi-codex-conversion` **3.0.35**:
https://github.com/IgorWarzocha/howaboua-pi-stuff

The native binary is unmodified. SHA-256:
`2b99a75c7b13787a23704062fb69a0fc983f204191b097edbd11844f9494bc59`

Retained license: `vendor/LICENSE.upstream` (MIT, copyright 2026 Igor Warzocha).
Bundled native dependency license/notice files are preserved under
`vendor/licenses/`. Those components retain their original licenses.
