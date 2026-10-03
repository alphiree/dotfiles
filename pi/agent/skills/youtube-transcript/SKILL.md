---
name: youtube-transcript
description: Fetch a timestamped transcript from a YouTube video using its available captions. Use when spoken video content matters. For UI, slides, code, or other visual details, use video_extract frames as well.
---

# YouTube transcript

Fetch YouTube-provided manual or auto-generated captions. This is caption extraction, not video understanding: the current assistant analyzes the returned text and images.

## Integration with `video_extract`

The local YouTube-only `video_extract` extension reuses this skill's `transcript.js` script. With just `url`, it retrieves captions; do not run the script again for the same captions. Set `transcript: true` to combine captions with `timestamp`/`frames` or the optional `thumbnail: true`. Frame/thumbnail-only requests skip captions by default. Thumbnails are promotional imagery, not timestamped video frames.

The extension makes no separate AI/API calls and supports neither local video files nor audio transcription. If captions cannot be retrieved, report speech as unavailable; any returned images support visual inspection only.

Use the commands below when the extension is unavailable or to list caption languages.

## Commands

```bash
# Default transcript, capped at 30,000 characters
node {baseDir}/transcript.js "https://youtu.be/VIDEO_ID"

# Prefer a caption language
node {baseDir}/transcript.js "URL_OR_ID" --lang en

# See caption languages before choosing one
node {baseDir}/transcript.js "URL_OR_ID" --languages

# Raise the context-safe output cap only when needed
node {baseDir}/transcript.js "URL_OR_ID" --max-chars 45000
```

## Workflow

1. Fetch captions first when the user asks about speech, claims, or quotes.
2. Preserve timestamps when citing or locating a statement.
3. If output is truncated, narrow the user question or raise `--max-chars` only as needed.
4. If captions are unavailable, say so clearly. Do not invent a transcript or infer speech from screenshots. Use `video_extract` frames for visual content; audio transcription is outside this skill and extension.

## Limits

- Captions may be unavailable, disabled, inaccurate, rate-limited, private, or region-restricted.
- Auto-generated captions can misrecognize names and technical terms.
- This skill does not download video/audio and needs no API key.
