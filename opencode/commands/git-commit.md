---
description: Create a git commit with user-approved commit message
agent: commit-drafter
model: llama.cpp/qwen3.5:35b_a3b
---

Creates a git commit using:

1. Saved commit message from getCommitMessage tool, OR
2. A newly generated message using conventional-commit skill

## Staged changes

!`git diff --staged`

## Steps

1. **Verify staged changes**
   - If nothing staged → Exit with error: "Nothing staged. Stage files first."

2. **Get commit message**
   - Call getCommitMessage()
     - If found → Use that message
     - If empty/null → Use conventional-commit skill to generate message → save using saveCommitMessage(message)
   - Display only the commit message (no additional text, no markup)

3. **Iterate or commit**
   - If user suggests changes → Update commit message using conventional-commit skill → save with saveCommitMessage(message)
   - If user approves → Run `git commit -m "{message}"`

## Error handling

- Not in git repo: Inform and exit
- Pre-commit hook failure: Show error

## Valid answer examples

### example 1

```markdown
chore(tui): configure theme and update bash permissions

- set TUI theme to catppuccin-latte in opencode.json
- create tui.json config with system theme
- add ls, head, tail commands to allowed bash permissions
- create backup of previous configuration
```

### example 2

```markdown
fix(api): resolve race condition in concurrent requests

- add mutex lock to shared session state
- defer unlock to prevent goroutine leaks
- add integration test for concurrent scenario
```

### example 3

```markdown
refactor(components): extract form validation to shared hook

- move validation logic from LoginForm and RegisterForm
- create useFormValidation hook with zod schema support
- update all form components to use new hook
```
