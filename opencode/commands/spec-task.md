---
description: Execute one spec task in an isolated child session
agent: spec-task-runner
subtask: true
model: openai/gpt-5.3-codex
---

Implement exactly one task from the spec artifacts.

Hard stop contract (non-negotiable):

- This command execution may complete **one and only one** task.
- After finishing the requested task, terminate and hand control back to the user.
- Do not auto-continue to any subsequent task, even if the user says "continue" in-session.
- Require a brand new explicit command invocation for each task:
  - `/spec-task <spec-slug> <task-id>`

User input: $ARGUMENTS

Expected input format:
`<spec-slug> <task-id> [optional notes]`

Input guardrails:

- If `<task-id>` is missing, stop and ask for explicit input format.
- If input is only `continue`/`next` (or similar), do not infer task IDs; instruct user to run `/spec-task <spec-slug> <task-id>` explicitly.

Workflow:

1. Find the task file in this order:
   - `.kiro/specs/<spec-slug>/tasks.md`
   - `.opencode/specs/<spec-slug>/tasks.md`
2. Read full context before coding:
   - `requirements.md` or `bugfix.md`
   - `design.md`
   - selected task (`<task-id>`) in `tasks.md`
3. Enforce strict progression gates:
   - `<task-id>` must be the next unchecked task in file order
   - all previous tasks must already be `[x]`
   - all dependency tasks must already be `[x]`
   - if blocked, stop and report required prerequisite tasks
4. Load skills listed under `Skills:` for the selected task.
5. Implement only that task scope.
6. Update `tasks.md` for `<task-id>` status and completion notes.
7. Run relevant checks/tests for that task.
8. If task-scoped files changed, stage only those files and delegate via the Task tool to the `commit-drafter` subagent, using the same commit workflow as `/git-commit`.
   - Do not rely on writing `@commit-drafter` inside the workflow prompt to trigger the subagent.
9. Stop immediately after completing `<task-id>`; do not begin any other task.
10. Return: changed files, validation results, commit result, and next recommended task ID only (no auto-execution).
11. If any follow-up asks to continue in the same session, refuse and repeat the explicit command required for the next task.
