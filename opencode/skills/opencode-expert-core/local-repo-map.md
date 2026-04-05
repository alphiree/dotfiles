## Local repository map

- ~/.config/opencode/opencode.json: global OpenCode runtime configuration.
- ~/.config/opencode/agents/: markdown-defined custom agents.
- ~/.config/opencode/commands/: reusable slash-style command templates.
- ~/.config/opencode/skills/: reusable skill definitions (skills/<name>/SKILL.md).
- ~/.config/opencode/node_modules/@opencode-ai/: locally installed OpenCode SDK/plugin packages.

## How to use this map

1. Start with opencode.json to inspect defaults (model, default_agent, agent, provider, permission).
2. Review agents/ for role prompts, model/variant overrides, and per-agent permissions.
3. Review skills/ to find reusable instruction modules and naming consistency.
4. Review commands/ for task templates bound to agents.
5. Cross-check behavior against schema/docs before changing structure.

## Constraints

- Prefer edits in ~/.config/opencode only.
- Keep agent/skill identifiers stable unless migration is intentional.
- Avoid duplicating conflicting definitions across JSON and Markdown unless deliberate.
