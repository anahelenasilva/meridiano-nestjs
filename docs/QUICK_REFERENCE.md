# Cursor + OpenCode Quick Reference

## When to Use Which Tool

| Task | Tool | How |
|------|------|-----|
| Quick question | Cursor | Direct chat |
| Small code fix | Cursor | Direct chat |
| Code review | Cursor | `@filename` |
| File navigation | Cursor | `@filename` |
| Large refactoring | OpenCode | `ocu "task"` |
| Multi-file changes | OpenCode | `ocu "task"` |
| Complex feature | OpenCode | `ocu "task"` |
| Deep exploration | OpenCode | `ocu "task"` |
| PRD-based work | Cursor | `/ralph` |

## Quick Commands

### Cursor Chat
```
@filename              # Reference a file
/generate-prd <task>   # Generate PRD
/ralph convert <file>  # Convert PRD to Ralph format
```

### OpenCode (via helpers)
```bash
ocp                    # Launch OpenCode
ocu "task"             # Task with ultrawork
oc-status              # Check configuration
oc-help                # Show all commands
```

### OpenCode Agents
```bash
oc-sisyphus "task"     # Main orchestrator
oc-oracle "task"       # Architecture/debugging
oc-librarian "task"    # Docs/code search
oc-explore "task"      # Fast codebase grep
oc-plan "task"         # Planner mode
```

## Common Workflows

### Adding a Feature
1. **Cursor**: Generate PRD → `/generate-prd add email notifications`
2. **OpenCode**: Implement → `ocu "add email notifications"`
3. **Cursor**: Review → Check changes, test, refine

### Large Refactoring
1. **Cursor**: Understand scope → Ask about current patterns
2. **OpenCode**: Execute → `ocu "refactor to use services"`
3. **Cursor**: Verify → Check edge cases, fix issues

### Bug Fixing
1. **Cursor**: Investigate → Quick exploration
2. **OpenCode**: Complex fix → `ocu "fix bug description"` (if multi-file)
3. **Cursor**: Simple fix → Direct chat (if single file)

## Magic Keywords

- **Cursor**: `@filename`, `/generate-prd`, `/ralph`
- **OpenCode**: `ultrawork` or `ulw` (automatic orchestration)

## Tips

1. **Start with Cursor** for most tasks
2. **Switch to OpenCode** when task is complex or multi-file
3. **Review everything** OpenCode does in Cursor
4. **Use Git branches** to separate work
5. **Iterate** between both tools

## Getting Help

- **Workflow Guide**: `docs/CURSOR_OPENCODE_WORKFLOW.md`
- **Setup Guide**: `docs/OPENCODE_SETUP.md`
- **OpenCode Help**: `oc-help`
- **Ralph Guide**: `scripts/ralph/README.md`
