---
description: Generate spec files with in-session review checkpoints
agent: spec-planner
model: openai/gpt-5.3-codex
---

Start or update a spec for: $ARGUMENTS

Required behavior:

1. Select workflow: feature or bugfix
2. Persist markdown files to:
   - `.kiro/specs/<spec-slug>/` if `.kiro/specs` exists
   - else `.opencode/specs/<spec-slug>/`
3. Run phases in order in THIS session:
   - Phase 1: create/update `requirements.md` (or `bugfix.md`) + ask review/confirm
   - Phase 2: create/update `design.md` + ask review/confirm
   - Phase 3: create/update `tasks.md`
4. At each checkpoint, show exact file path to review.
5. If user asks for changes, tell them which file to edit and wait for `confirm`.
6. End with execution handoff:
   - `/spec-task <spec-slug> T1`

If key information is missing, ask clarifying questions before finalizing the plan.
