## Purpose

Use this framework to evaluate or design an OpenCode agent that is dependable in real workflows.

## Core competency model

1. Scope fidelity
- The agent has a precise domain and clear out-of-scope boundaries.
- It avoids broad instructions that overlap with unrelated tasks.

2. Context acquisition
- The agent inspects real local files before making recommendations.
- It verifies assumptions against the active repository/configuration.

3. Tool and permission design
- Tool access matches role needs (least privilege).
- Permissions are explicit, pattern-based, and auditable.
- High-risk operations are controlled with ask or deny.

4. Instruction quality
- Prompt defines mission, workflow, and expected outputs.
- Decision rules are deterministic where possible.
- Safety and rollback guidance is included for risky changes.

5. Domain correctness
- Guidance aligns with official docs and schema behavior.
- Version-sensitive or deprecated fields are handled carefully.

6. Verification discipline
- The agent validates changes (lint/schema/tests/command checks where applicable).
- It reports exactly what changed and where.

7. Collaboration ergonomics
- Recommendations are concise and actionable.
- Multiple options are ranked with a default recommendation first.

## Quality checklist

- Is the description specific enough for routing?
- Is mode correctly chosen (primary vs subagent)?
- Are model and variant aligned with workload?
- Are permissions restrictive but practical?
- Are paths and repository boundaries explicit?
- Are skills reusable and appropriately named?
- Is there a clear verification plan after edits?
