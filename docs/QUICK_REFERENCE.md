# Cursor + OpenCode Quick Reference

## Current Canonical Docs

- Helper script: `scripts/opencode-helpers.sh`
- Ralph guide: `scripts/ralph/README.md`

## When to Use Which Tool

| Task                                      | Recommended Tool | Fastest Entry Point              |
| ----------------------------------------- | ---------------- | -------------------------------- |
| Quick question, code explanation          | Cursor           | Direct chat                      |
| Single-file/small-scope fix               | Cursor           | Direct chat with file references |
| Code review and local navigation          | Cursor           | `@filename` or `@folder`         |
| Multi-file refactor                       | OpenCode         | `ocu "task"`                     |
| Complex implementation with orchestration | OpenCode         | `ocu "task"`                     |
| Architecture-heavy debugging              | OpenCode         | `oc-oracle "task"`               |
| Broad codebase exploration                | OpenCode         | `oc-explore "task"`              |
| Planner-first work                        | OpenCode         | `oc-plan "task"`                 |
| PRD-driven implementation                 | Cursor           | `/generate-prd` and `/ralph`     |

## Quick Commands

### Cursor Chat
```text
@filename               # Reference a file
@folder/                # Reference a folder
/generate-prd <task>    # Generate PRD
/ralph convert <file>   # Convert PRD to Ralph JSON format
```

### OpenCode Helpers (from `scripts/opencode-helpers.sh`)
```bash
ocp                     # Launch OpenCode in project context
ocu "task"              # Run task with ultrawork orchestration
oc-status               # Show OpenCode setup status
oc-help                 # List helper commands and examples
```

### Agent-Specific Helpers
```bash
oc-sisyphus "task"      # Main orchestrator
oc-oracle "task"        # Architecture and debugging
oc-librarian "task"     # Docs/code research
oc-explore "task"       # Fast exploration
oc-plan "task"          # Planner mode (Prometheus)
```

## Setup Reminder

If helper commands are not available, source the script:

```bash
source scripts/opencode-helpers.sh
```

For permanent setup, add the source command to your shell profile.

## Common Workflows

### New Feature
1. Cursor: `/generate-prd <feature>`
2. Cursor (optional): `/ralph convert <prd-file>`
3. OpenCode: `ocu "<implement feature>"` for multi-file execution
4. Cursor: review, test, and refine

### Large Refactor
1. Cursor: map scope and constraints
2. OpenCode: `ocu "<refactor task>"`
3. Cursor: verify edge cases and types

### Bug Fixing
1. Cursor: reproduce and isolate
2. OpenCode: use `ocu` if fix spans multiple files
3. Cursor: finalize with focused validation

## Keywords That Matter

- Cursor: `@filename`, `/generate-prd`, `/ralph`
- OpenCode: `ultrawork` (auto-orchestration through `ocu`)

## Practical Guidelines

1. Start in Cursor by default.
2. Switch to OpenCode once changes are broad or multi-step.
3. Review all generated changes before commit.
4. Keep branch scope tight per task.
5. Alternate tools intentionally: plan -> execute -> verify.
