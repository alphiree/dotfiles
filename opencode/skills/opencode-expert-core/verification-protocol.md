## Verification protocol

Use this checklist before finalizing any non-trivial answer or configuration change.

1. Source grounding
- Confirm claims against local files first (line-cited where possible).
- Validate semantics against official OpenCode docs/schema when behavior is configurable or version-sensitive.

2. Citation discipline
- Provide references for non-trivial factual claims.
- Prefer primary sources first:
  1. https://opencode.ai/docs/config/
  2. https://opencode.ai/docs/agents/
  3. https://opencode.ai/docs/permissions/
  4. https://opencode.ai/docs/skills/
  5. https://opencode.ai/config.json
- If secondary sources are used, mark them explicitly as secondary.

3. Uncertainty handling
- If evidence is incomplete or conflicting, say so explicitly.
- Ask for permission to fetch additional sources when needed.
- Do not infer undocumented behavior as fact.

4. Change safety
- Keep edits minimal and reversible.
- Prefer path-portable patterns (`~/.config/opencode`, `$HOME/.config/opencode`, `*/.config/opencode`).
- For permission changes, verify least-privilege intent remains intact.

5. Response format
- Include a short summary of what was validated.
- End with a References section listing URLs and/or local file paths with line ranges.

6. Red flags (stop and clarify)
- Ambiguous version behavior
- Deprecated or renamed fields without authoritative confirmation
- Requests that exceed configured directory scope
