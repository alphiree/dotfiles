# Voice dictation for Pi

Dictate into Pi's editor, review the transcript, or send it directly. Uses your
Pi `openai-codex` login for OpenAI transcription; no separate API key is required.

## Requirements

- Pi with an authenticated `openai-codex` account.
- Node.js 22.19 or later.
- Linux x64 and a microphone. Other platforms require a compatible native audio
  helper; only the Linux x64 helper is included.
- Access to OpenAI's transcription endpoint. Availability and account limits are
  controlled by OpenAI and may change.

## Installation

Copy this directory to `~/.pi/agent/extensions/voice-dictation`, then install its
runtime dependency:

```sh
cd ~/.pi/agent/extensions/voice-dictation
npm ci --ignore-scripts
```

Pi discovers the extension automatically. Run `/reload` or restart Pi to load it.
Disable any other extension using **Ctrl+Alt+D** to avoid shortcut conflicts.

## Usage

| Shortcut or command | Action |
| --- | --- |
| **Ctrl+Alt+D** or `/dictate` | Start recording; use again to stop and transcribe into the editor for review. |
| **Enter** while recording or transcribing | Finish transcription and send the entire editor draft, including existing typed text. |
| `/dictate stop` | Stop recording and transcribe for review. |
| `/dictate cancel` | Discard the recording or cancel transcription. |
| `/dictate status` | Show state, microphone setting, and vocabulary term count. |

Wait for `voice: recording` before speaking. The footer shows a scrolling
microphone level history; `clipping risk` indicates excessive input volume.

Transcripts are pasted into the editor without a separate rewriting step. If Pi
is busy, **Enter** queues the draft as a steering message. Empty or failed
transcription sends nothing. **Shift+Enter** and normal idle editing are unchanged.

Shutdown, `/reload`, and session switches cancel recording and pending submission.
Microphone capture starts only when you explicitly activate dictation and the
transcription connection is ready.

## Configuration

Optionally copy `config.json.example` to `config.json` in this directory.
`config.json` is Git-ignored. Run `/reload` after editing it.

```json
{
  "inputDevice": "",
  "vocabulary": ["Pi", "Codex", "TypeScript"]
}
```

- **`inputDevice`**: empty uses the audio helper's platform-default microphone.
  On Linux with PipeWire, use `alsa:pipewire` to follow the default PipeWire input,
  or specify a native helper device ID to select a particular microphone.
- **`vocabulary`**: optional spelling hints for names and technical terms. Omit it
  or use `[]` for no hints. Keep the list short: hints can bias recognition and
  are not guaranteed replacements.

Vocabulary accepts up to 32 nonempty, single-line terms, 64 characters per term,
and 1024 characters for the joined list. Surrounding whitespace and
case-insensitive duplicates are removed. Invalid configuration reports an error.
Without a configuration file, the default microphone is used with no hints.

## Privacy

Audio streams to OpenAI's
`wss://api.openai.com/v1/realtime?intent=transcription` endpoint using
`gpt-4o-mini-transcribe`. Vocabulary hints are also sent to OpenAI; do not include
secrets in them.

The extension does not save audio files or transcript history, log tokens, or
read editor drafts, session history, or repository files for transcription
context. It does not change your selected model or provider. There is no
background recording or local network listener.

## Development

No build step is required. Run `npm test` to check configuration, audio handling,
and transcription behavior using synthetic audio and fake connections. Tests
do not record the microphone, contact OpenAI, or use real credentials.

## Licenses

Third-party license and copyright notices are included in
[`vendor/LICENSE.upstream`](vendor/LICENSE.upstream) and
[`vendor/licenses/`](vendor/licenses/).
