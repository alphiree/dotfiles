---
name: opencode-expert-core
description: Unified OpenCode configuration reference, competency model, workflow playbook, and local repo map for opencode-focused agents.
compatibility: opencode
metadata:
  audience: opencode-expert-agents
  updated: 2026-04-04
references:
  - docs-reference
  - agent-competencies
  - config-playbook
  - local-repo-map
---

## Purpose

Single-source operating guide for OpenCode configuration specialists.

This consolidated skill replaces separate loading of these modules:

- docs reference
- agent competency framework
- config playbook
- local repository map

## Core modules (always load)

@docs-reference.md

@agent-competencies.md

@config-playbook.md

@local-repo-map.md

## Practical defaults

- For config-focused agents, use low temperature and medium/high reasoning variant.
- Use explicit path restrictions when editing sensitive configuration.
- Keep description specific so Task routing chooses the right agent.
