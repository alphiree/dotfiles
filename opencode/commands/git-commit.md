---
description: Create a Conventional Commit from staged changes in a child session
agent: commit-drafter
model: llama.cpp/qwen3.5:35b_a3b
subtask: true
---

Create the git commit inside this child session.

User notes for the commit message, if any: $ARGUMENTS

Workflow:

1. Verify this is a git repository.
2. Verify there are staged changes.
   - If nothing is staged, stop and say: `Nothing staged. Stage files first.`
3. Inspect the staged changes with git commands.
4. Draft the best Conventional Commit message that matches the staged changes.
   - Use any user notes only as guidance.
   - Use a valid type such as `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `build`, `ci`, `perf`, `style`, or `revert`
   - Add a scope only when it is clearly useful
   - Keep the subject concise and imperative
   - Add a body only when it improves clarity
5. Create the commit with `git commit` inside this child session.
6. After a successful commit, report the final commit message.

Hard rules:

- Treat invoking `/git-commit` as explicit approval to create the commit now.
- Perform the actual commit inside this subagent session.
- Do not hand off the commit step to the parent agent.
- Do not rely on nonexistent tools or undefined skills.
- If not inside a git repository, stop and say so clearly.
- If the commit needs a body, pass it using additional `-m` flags.
- If `git commit` fails, show the error and stop.

Answer style:

- Briefly confirm success and include the final commit message.
- If the commit fails, briefly report the failure and include the error.

Suggested inspection commands:

- `git rev-parse --is-inside-work-tree`
- `git status --short`
- `git diff --staged`

Suggested commit command pattern:

- Subject only: `git commit -m "type(scope): subject"`
- Subject + body: `git commit -m "type(scope): subject" -m "body line 1\nbody line 2"`

Example final message:

```markdown
fix(commit): run the git commit inside the child session

- keep the full commit workflow inside the subagent
- use the command model override for offline commit drafting
- avoid handing the final commit back to the parent agent
```
