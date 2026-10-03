# YouTube extraction for Pi

A small `video_extract` tool that returns evidence to the current assistant:
YouTube captions, timestamped PNG frames, and optional promotional thumbnails.
It does not call another model, transcribe audio, or support local files.

## Dependencies

- Captions: Node.js and the existing `../../skills/youtube-transcript/transcript.js`
  script, with its `youtube-transcript-plus` dependency installed in that skill.
- Frames: `yt-dlp` and `ffmpeg` on PATH.
- Thumbnails: `ffmpeg` on PATH (converts YouTube's thumbnail to PNG).
- No Gemini credentials or extra model API are used. The current assistant still
  consumes tokens/context when interpreting returned text and images.

This local extension expects the sibling skill layout above. Moving/distributing
it independently requires keeping that layout or updating the script path.

## Tool examples

```json
{"url":"https://youtu.be/0Rp9KJCEIvg"}
```

Fetch captions only (30,000-character default). Optional `lang` selects a caption
language; `max_chars` can raise the cap to 50,000. These are passed to the skill's
script; no caption retrieval logic is duplicated in this extension.

```json
{"url":"https://youtu.be/0Rp9KJCEIvg","timestamp":"3:00"}
{"url":"https://youtu.be/0Rp9KJCEIvg","timestamp":"2:58-3:03","frames":4}
{"url":"https://youtu.be/0Rp9KJCEIvg","frames":6}
```

Fetch one frame, evenly spaced range frames, or samples across the full video.
Ranges support dense sampling; a single timestamp plus a count uses 5-second
spacing. Maximum: 12 frames. Frame requests do not fetch captions by default.

```json
{"url":"https://youtu.be/0Rp9KJCEIvg","thumbnail":true}
{"url":"https://youtu.be/0Rp9KJCEIvg","transcript":true,"timestamp":"3:00","thumbnail":true}
```

Thumbnails are opt-in and labeled as promotional artwork, not video frames.
Set `transcript:true` to combine captions with frames and/or a thumbnail.
The timestamp controls frames only; it does not filter the caption transcript.

## Limits and failure handling

- Missing captions are explicitly reported as a speech-analysis limitation.
  No speech is generated from images and there is no automatic ASR fallback.
- Rate limits, network failures, missing dependencies, and inaccessible videos
  are reported separately from known caption unavailability.
- Successful captions/images survive failures in other requested components.
  Partial frame failures include the failed timestamps and reasons.
- Captions may be auto-generated or inaccurate; the assistant should not treat
  claims in captions as independently verified facts.
- Sampled frames miss some motion and brief visual events. They carry no audio.
- Caption output is additionally capped at 1,900 lines/40KB. If that display cap
  is hit, the script output is saved to a temporary file for `read`. The script's
  own character cap still applies and omitted captions are explicitly reported.
- Active live streams and local files are unsupported. YouTube restrictions are
  not bypassed. `yt-dlp` runs with `--ignore-config` for predictable extraction.
- Subprocesses have timeouts and receive Pi's cancellation signal. Frames are
  extracted sequentially to bound resource use. No whole-video file is saved.

## Development

Run the offline tests with Pi installed on PATH:

```bash
node --test ~/.pi/agent/extensions/video-extract/tests/video-extract.test.mjs
```

Tests use Pi's real extension loader and mock external processes; they need no
network, media downloads, or model credentials. Set `PI_PACKAGE_DIR` to the
installed Pi package root if your `pi` executable is a wrapper.

Use `/reload` in Pi after changing the extension to load the updated tool schema.
