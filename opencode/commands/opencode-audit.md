---
description: Run a read-only audit of the local OpenCode configuration.
agent: opencode-auditor
model: openai/gpt-5.3-codex
---

Audit the OpenCode setup rooted at the active OpenCode config root (typically `~/.config/opencode`).

Requirements:

1. Operate in read-only mode.
2. Do not run write/edit/patch operations.
3. Do not access paths outside the active OpenCode config root.
4. Evaluate:
   - `opencode.json` schema-aligned usage
   - agent definitions in `agents/`
   - command definitions in `commands/`
   - skills in `skills/`
   - permission safety and least-privilege posture
   - portability regressions, especially user-specific absolute home paths (for example `/home/<user>/.config/opencode` or `/Users/<user>/.config/opencode`)
   - default agent wiring and model/variant consistency
5. Report:
   - status (`healthy`, `needs attention`, `critical`)
   - prioritized findings with severity
   - exact file paths for each finding
   - any user-specific absolute paths as explicit portability findings
   - concrete remediation steps

Keep the response concise and actionable.
