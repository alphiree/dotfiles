## What this module provides

A compact operational reference for configuring OpenCode correctly and consistently.

## Core references

- Config docs: https://opencode.ai/docs/config/
- Agents docs: https://opencode.ai/docs/agents/
- Permissions docs: https://opencode.ai/docs/permissions/
- Skills docs: https://opencode.ai/docs/skills/
- JSON schema: https://opencode.ai/config.json

## Configuration facts to remember

- Config sources merge; they do not replace each other.
- Precedence order (lowest to highest):
  1. Remote .well-known/opencode
  2. Global ~/.config/opencode/opencode.json
  3. OPENCODE_CONFIG
  4. Project opencode.json
  5. .opencode directories (agents/, commands/, skills/, etc.)
  6. OPENCODE_CONFIG_CONTENT
- default_agent must be a primary agent or OpenCode falls back to build.

## Agent design facts

- mode values: primary, subagent, all.
- Primary agents are user-facing and switchable with Tab.
- Subagents are invoked by @mention or Task tool.
- Markdown agents live in ~/.config/opencode/agents/ and .opencode/agents/.
- Agent file name is the agent ID.

## Skills system facts

- Skill path shape: skills/<name>/SKILL.md.
- Required frontmatter fields: name, description.
- Name format regex: ^[a-z0-9]+(-[a-z0-9]+)*$.
- Agents discover skills and load them using the skill tool.

## Permissions facts

- Rule actions: allow, ask, deny.
- Last matching rule wins.
- external_directory controls access outside current workspace.
- Prefer explicit "*": deny plus selective allow rules for sensitive agents.
