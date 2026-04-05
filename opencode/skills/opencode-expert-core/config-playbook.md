## Use this for

- Creating or tuning primary agents
- Adding subagents for focused delegation
- Configuring model/variant choices per agent
- Setting safe permission policies
- Introducing reusable skills for repeated workflows

## Standard workflow

1. Inspect current state
- Read opencode.json and existing agents/, skills/, commands/.
- Identify defaults, conflicts, and naming collisions.

2. Define intent
- Clarify target role, scope, and safety boundaries.
- Choose primary or subagent mode.

3. Configure model strategy
- Pick model by capability and cost profile.
- Set variant to match reasoning needs (low, medium, high when available).

4. Apply permissions
- Start with restrictive baseline in sensitive environments.
- Add explicit allow rules for required commands/paths.
- Use external_directory to enforce workspace boundaries.

5. Add reusable skills
- Create skills/<name>/SKILL.md with strict naming rules.
- Keep skills focused and composable.

6. Verify and report
- Confirm files parse and key references are valid.
- Provide changed files, behavior impact, and rollback notes.

## Heuristics

- Prefer one strong specialist over many overlapping agents.
- Keep prompts operational, not philosophical.
- Treat permissions as product design, not an afterthought.
- Minimize global defaults that can surprise project configs.
