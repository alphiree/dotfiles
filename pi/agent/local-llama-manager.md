# Local llama.cpp image input

`extensions/local-llama-manager.ts` keeps models text-only unless explicitly opted in:

```json
{
  "path": "~/Desktop/models/Qwen3.5-9B-Q4_K_M.gguf",
  "input": ["text", "image"],
  "mmproj": "~/Desktop/models/qwen3.5-9b-mmproj-F16.gguf"
}
```

- `input` is optional (default `["text"]`). Only unique `text`/`image` capabilities including `text` are accepted.
- `mmproj` is required for image input and rejected on text-only entries. It supports `~`, `$HOME`, `${HOME}` and paths relative to `PI_CODING_AGENT_DIR` (normally `~/.pi/agent`). Existing main-model path behavior is unchanged.
- Before registering models or switching servers, the manager requires a readable regular projector file with the GGUF signature. Conflicting projector selection flags in model/common args are rejected for image-capable entries. Offload tuning such as `--no-mmproj-offload` is still allowed.
- The configured capabilities are advertised to Pi, and the projector is supplied once via `--mmproj`. Reload Pi after changing capabilities.
- File validation is **not** tensor/architecture validation. Obtain the projector for the exact base model; llama.cpp checks actual compatibility on load. An arbitrary GGUF is not sufficient.

## Same-alias startup changes and restart

An alias is not proof that the running server matches the current configuration. For a **verified extension-owned** same-alias process, the manager compares the saved `current.json` startup argument array with the exact ordered result of `buildServerArgs`. Matching arguments retain the no-`/models`-network reuse path, including a busy server. Missing/malformed saved arguments fail closed.

Changing the main-model path, adding/changing/removing the projector (including switching between text and image input), or changing common/model startup arguments requires an explicit restart. Selection and requests fail with:

```text
Restart required: /local-llm restart <alias>
```

The manager does **not** automatically stop/reload a same-alias server on a mismatch, even if it is busy. Idle timers and automatic session shutdown also leave a mismatched server alone; a rejected prompt exiting Pi must not stop it. After reviewing the new configuration, run `/local-llm restart <alias>`; it waits for the server-use lock, validates the desired arguments before shutdown, and restarts only verified owned processes. Reload Pi after capability changes so its registered model capabilities match the configuration, then resend the rejected prompt. Selecting a different alias retains the existing owned-server switch behavior, with argument validation before shutdown.

**External/unverifiable servers:** both text-only and image-capable same-alias reuse are now rejected. This deliberately tightens the old text-only alias-based behavior too: `/models` cannot verify paths, projectors, or startup options. External same/different-alias processes are never stopped/adopted. Stop them manually, then select the local model or resend the prompt. `/local-llm restart <alias>` reports an error, not a successful restart, when a detected external server occupies the endpoint.

Pi logs and continues after `before_agent_start` errors; throwing there alone does not cancel inference. A second check in this provider's stream entrypoint validates current owned identity and startup arguments before delegating to Pi's normal OpenAI Completions serializer. Rejections become assistant errors without an inference HTTP request (also on retries/tool continuations); this does not change other providers or Pi's global hook semantics. Status avoids calling stale/external same-alias configurations loaded/ready.

Scope: comparison is exact startup arguments, not file hashes or GGUF tensor compatibility. Replacing model/projector contents in place without changing their paths is not detected; explicitly restart in that case. Saved state remains trusted same-user data. Existing PID/executable/group ownership checks and their documented race limitations are unchanged. No active configuration, profile, models store, model/projector assets, or original vision design is changed by this fix.

Regression tests (Node 25; mocked tests need no install, `request-guard.test.ts` additionally needs Linux and the installed `pi` CLI, override with `PI_TEST_CLI`):

```sh
node --test pi/agent/extensions/tests/local-llama-manager.test.mjs pi/agent/extensions/local-llama-manager/*.test.ts
```

## Manual single-photo test outside Pi

Stop any other local model first to avoid competing for GPU/RAM. For this machine, start the installed llama.cpp Web UI on a separate loopback port (8081 must be unused):

```sh
~/llama.cpp/build/bin/llama-server \
  --model ~/Desktop/models/Qwen3.5-9B-Q4_K_M.gguf \
  --mmproj ~/Desktop/models/qwen3.5-9b-mmproj-F16.gguf \
  --host 127.0.0.1 --port 8081 --parallel 1 \
  --ctx-size 8192 --n-gpu-layers 99 \
  --batch-size 512 --ubatch-size 128 --flash-attn on \
  --cache-type-k q4_0 --cache-type-v q4_0 --cache-ram 0 \
  --image-max-tokens 1024 --jinja \
  --chat-template-kwargs '{"enable_thinking":false}'
```

Wait for startup, open `http://127.0.0.1:8081`, attach one photo, and ask it to describe visible details or transcribe text without guessing. The Web UI is enabled by default in installed llama.cpp 9631. This 8K context is for a small standalone photo conversation, not the larger research-agent prompt; it does not change Pi's 32K settings. Stop this manually launched server with Ctrl+C in its terminal before using Pi's local model. It is external to the manager and is deliberately not adopted by it. These command flags were checked against the installed binary; no new real-photo acceptance run was performed for this bug fix.

## Verified Qwen3.5-9B setup (2026-10-03)

No initiating-checkout configuration was activated. The prepared, ignored configuration files are in the topic worktree:

- `pi/agent/local-llms.json`
- `pi/agent/pi-subagents-profiles.json`
- Backups: `pi/agent/local-llms/backups/local-llms.original.json` and `pi-subagents-profiles.original.json`
- Projector copied and SHA-256 verified at `~/Desktop/models/qwen3.5-9b-mmproj-F16.gguf`; both prepared and isolated runtime configs now use this path. Original download retained at `pi/agent/local-llms/assets/qwen3.5-9b-mmproj-F16.gguf` in the worktree.
- Isolated runtime/config/session/evidence directory: `pi/agent/local-llms/runtime/`

Worktree root: `/home/alphire/dotfiles/.git/pi-subagents/worktrees/67592c91-176e-4435-a677-3721955eb6da`.

### Provenance

Existing main model `/home/alphire/Desktop/models/Qwen3.5-9B-Q4_K_M.gguf`:
SHA-256 `03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8`, matching [Unsloth's published standard Q4_K_M](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/blob/3885219b6810b007914f3a7950a8d1b469d598a5/Qwen3.5-9B-Q4_K_M.gguf).

Projector: standard [Unsloth/Qwen3.5-9B-GGUF](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/tree/3885219b6810b007914f3a7950a8d1b469d598a5), base `Qwen/Qwen3.5-9B`, not an uncensored variant.

```sh
curl -fL --max-time 300 -o pi/agent/local-llms/assets/qwen3.5-9b-mmproj-F16.gguf \
  https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/3885219b6810b007914f3a7950a8d1b469d598a5/mmproj-F16.gguf
sha256sum pi/agent/local-llms/assets/qwen3.5-9b-mmproj-F16.gguf
```

Downloaded SHA-256: `f70dc3509053962b0d0d3ee8a7eacebf5d60aa560cad78254ae8698516ae029f` (918,166,080 bytes), matching the published F16 projector. Successful live image inference validates the pair beyond file signatures.

Installed binary `/home/alphire/llama.cpp/build/bin/llama-server --version`: `9631 (6e14286ed)`, GNU 15.2.1/Linux x86_64. Source HEAD `6e14286edaa60a223292c8a996506905b2f66f66`; runtime logs confirm CUDA/RTX 4060 Laptop GPU. Neither binary nor existing model assets were replaced.

### Final target settings

Only `qwen3.5-9b-q4-k-m` changed. Other model entries and global server policy are identical to the backup.

- Context: **32768**, output maximum: **2048**.
- One server slot; GPU layers 99 (full offload); projector GPU offload default.
- Batch 512 / microbatch 128; threads 8 / batch threads 8.
- Flash attention on; K/V caches `q4_0`; host prompt cache (`--cache-ram`) 0.
- `--image-max-tokens 1024`; Jinja enabled; thinking disabled.
- Removed `--mlock`, avoiding locking the model into constrained host RAM.

8K was insufficient for actual research: a successful image read and `websearch` returned a subsequent 11,400-token prompt, rejected by the server. 32K supports the verified workflow and ordinary Pi compaction defaults; this was a settings correction, not a retry workaround.

### Isolated live acceptance

Runtime used `PI_CODING_AGENT_DIR=<worktree>/pi/agent/local-llms/runtime` and `PI_CODING_AGENT_SESSION_DIR=<runtime>/sessions`. Runtime-only server overrides: loopback port **18080**, separate `server/` state, absolute worktree projector path. It never reused the source's server state/port. Inherited `PI_SUBAGENT_*` lineage was removed to create an independent test root; existing terminal-host context was retained. No unrelated server was running or stopped.

Loaded the existing `pi-websearch@0.7.1` extension and `/home/alphire/Desktop/projects/tools/pi-subagents/pi-extension/subagents/index.ts` read-only, plus the worktree manager. Existing researcher definition requires `websearch,webfetch`; optional `read` was enabled for the supplied image. `agent_browser` was absent/not needed. Automatic retries were disabled; successful final research used **enabled standard compaction**, without custom token settings.

The isolated auth file is a private copy, not a symlink. `PI_CODING_AGENT_DIR=<runtime> PI_TELEMETRY=0 pi update --models` populated its catalog through Pi itself; no models-store file was manually edited. Source credentials/config were not updated.

Commands and JSONL results are retained under `runtime/evidence/`:

```sh
python pi/agent/local-llms/runtime/evidence/image-test.py
python pi/agent/local-llms/runtime/evidence/delegation-test.py
```

The image script launches:

```sh
pi --no-approve --no-skills --no-context-files --no-tools \
  --model llama-cpp-local/qwen3.5-9b-q4-k-m --thinking off --mode json \
  @<runtime>/evidence/shapes.png \
  'Describe the two colored shapes and their left/right positions. Be brief.'
```

Final response: **“Red square: Left side; Blue circle: Right side”**, 644 input / 16 output tokens, `stop`, zero cost. Image fixture is 448×224 PNG, generated locally; no answer labels are embedded in it.

The RPC parent ran `openai-codex/gpt-6.1-sol`, invoked `/profile codex-local-vision-researcher`, then called `subagent` for the **existing researcher**, with no model/thinking override. The durable launch manifest records profile `codex-local-vision-researcher`, model `llama-cpp-local/qwen3.5-9b-q4-k-m`, thinking `off`. Successful child run: `c7656709-224d-4593-b933-87a7140b246f`; child session `2026-10-03T06-58-15-965Z_3f449cd3-ae48-457b-b578-591a78ef78c6.jsonl`.

Verified in the child session, not just the parent's summary:

1. `read` returned the actual PNG as image content; Qwen described the correct shapes/positions.
2. `websearch` executed with `numResults: 2`, returned official llama.cpp documentation, `isError: false`.
3. `webfetch` executed on `https://raw.githubusercontent.com/ggml-org/llama.cpp/master/docs/multimodal.md`, returned actual documentation, `isError: false`.
4. Child returned the correct `--mmproj` option and default projector GPU offload policy with the fetched link; parent joined its durable result.

### Measured memory

Sampled approximately once per second with `nvidia-smi` and `/proc/meminfo`; server RSS came from `/proc/<managed-pid>/status`. Values below are MiB. **Host used means MemTotal − MemAvailable**, not sum of process RSS. These are sampled maxima, not guaranteed instantaneous peaks; desktop/background usage is included.

| Final experiment | GPU baseline / sampled max | Host used baseline / sampled max | Minimum available host | Max server RSS | Swap baseline / end |
|---|---:|---:|---:|---:|---:|
| Direct image, 34 samples | 644 / 7268 | 11446 / 12086 | 3078 | 3613 | 10739 / 12448 |
| Profile researcher, 76 samples | 617 / 7308 | 10530 / 11805 | 3359 | 4039 | 11311 / 11229 |

GPU total was 8188 MiB; host total 15164 MiB; swap total 23440 MiB. The initial 8K image test had only 1168 MiB minimum available host and increased whole-host swap use from 8778 to 11739 MiB. Host pressure is real; do not claim no swapping or reserve all nominal memory. Tests completed without OOM; extension-owned servers shut down afterward (`ps -C llama-server` empty).

### Manual activation / limits

After reviewing/integrating the tracked code, **separately** review the ignored JSON diffs and transfer only the target entry, added profile and verified projector into the user's active configuration. Do not replace current live files wholesale: they may have changed since the backups. The projector is already copied to `~/Desktop/models/qwen3.5-9b-mmproj-F16.gguf`; retain that configured path. `/reload` the manager and choose `/profile codex-local-vision-researcher` when desired.

The hybrid profile copies `codex-only`, changing **only researcher** to local Qwen/off. All other roles/default runtime are unchanged; original `defaultProfile: codex-only` and all original profiles remain untouched. No new agent/framework was created.

The verified smoke workload uses a small image and two research tools. Large/multiple images, longer research, concurrent agents, and an already-busy desktop can consume more memory or trigger compaction; the 1024 image-token cap trades detail for headroom. Keep one local model loaded and monitor memory. This is not an all-workloads capacity guarantee. Activation is intentionally left to the user; ignored configuration/assets/backups/runtime artifacts do not travel with the Git commit.

### Follow-up: models-directory placement and retest

At the user's request, copied (not re-downloaded) the projector into `~/Desktop/models/` under the existing `alphire` account. Verified all 918,166,080 bytes against the SHA-256 above. Updated only the worktree's prepared and isolated runtime configurations; active/main configuration was unchanged.

Re-ran `runtime/evidence/image-test.py` with the Desktop projector path using the installed llama.cpp 9631 binary, isolated loopback port 18080 and worktree server state. Exit 0; actual response: **“Left: Red square; Right: Blue circle”**, 652 input / 12 output tokens. Sampled GPU peak 7248 MiB; minimum host available 1959360 KiB (about 1913 MiB). No llama-server remained afterward. Previous direct-image evidence was preserved in `runtime/evidence/before-models-path-retest/`; latest `image-*` outputs describe this retest. Researcher delegation was not repeated in this follow-up.

A read-only three-way file merge check against main at `7273313` found one conflict in `startServer`: main adds `expectedExecutable = executableIdentity(...)` where this branch adds `args = buildServerArgs(...)`. At that stage no merge/rebase or main edits were performed.

### Security integration verification

On explicit merge approval, discovered that main's earlier history had been rewritten. Aborted the resulting broad merge conflicts and replayed only the three vision/docs commits onto integration branch `pi-integrate/qwen-vision-67592c91`, based on main `2658980`. Original topic branch retained. The single relevant startup conflict was resolved by keeping both argument validation and executable identity verification before opening resources. All process-identity checks and verified shutdown behavior remain intact.

Updated the security wiring test harness to use the extracted argument builder and added a regression for invalid vision configuration failing before resources are opened. Combined vision/security tests: **43/43 pass**. The worktree prepared configuration still changes only standard Qwen; global configuration, other models, existing profiles and the default profile remain unchanged.

Repeated the isolated live image test with the integrated security+vision manager, installed CUDA llama.cpp, and Desktop projector: exit 0; **“A red square is on the left. A blue circle is on the right.”** (652 input / 20 output tokens). Sampled GPU peak 7294 MiB; minimum host available 2676976 KiB (about 2614 MiB). No llama-server remained after shutdown. Prior evidence preserved under `runtime/evidence/before-security-integration-retest/`; current `image-*` files contain this run. This does not repeat the earlier researcher-delegation acceptance or expand workload guarantees. Active ignored configuration remains unmodified; code integration does not activate vision.
