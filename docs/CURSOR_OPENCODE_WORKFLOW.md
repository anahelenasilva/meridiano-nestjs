# Cursor + OpenCode Workflow Guide

This guide explains how to effectively use both Cursor and OpenCode together in your development workflow.

## Overview

**Cursor** and **OpenCode** complement each other:

- **Cursor**: Quick edits, code review, file navigation, immediate feedback
- **OpenCode**: Complex multi-step tasks, orchestrated agent workflows, background processing

## When to Use Which Tool

### Use Cursor Chat For:
- Quick questions and clarifications
- Small code changes and fixes
- Code review and suggestions
- File navigation and exploration (`@filename`)
- Understanding existing code
- Quick refactoring (single file or small scope)
- Using Ralph for PRD-based autonomous tasks

### Use OpenCode For:
- Complex multi-file refactoring
- Large feature implementations
- Tasks requiring multiple agents (use `ultrawork` keyword)
- Background processing and parallel agent execution
- Deep codebase exploration with multiple agents
- Tasks that need orchestration across many files
- When you want agents to work until completion automatically

## Workflow Patterns

### Pattern 1: Planning in Cursor, Execution in OpenCode

1. **In Cursor**: Plan and break down the task
   ```
   "I need to add authentication middleware to all protected routes.
   Break this down into steps."
   ```

2. **In OpenCode**: Execute with orchestration
   ```bash
   opencode
   # Then: "Add authentication middleware to all protected routes ultrawork"
   ```

3. **Back to Cursor**: Review and refine
   - Review changes in Cursor
   - Make quick adjustments
   - Test and iterate

### Pattern 2: Exploration in OpenCode, Implementation in Cursor

1. **In OpenCode**: Deep exploration
   ```bash
   opencode
   # "Explore the authentication system and document all auth flows ultrawork"
   ```

2. **In Cursor**: Implement based on findings
   - Use the exploration results
   - Implement changes with Cursor's quick feedback
   - Leverage Cursor's file navigation

### Pattern 3: Parallel Workflows

1. **OpenCode**: Working on a large refactoring
   ```bash
   opencode
   # "Refactor all services to use dependency injection ultrawork"
   ```

2. **Cursor**: Working on a separate feature
   - Use Cursor chat for unrelated quick tasks
   - Both can work on different parts simultaneously

## Setup Helper Scripts

### Quick OpenCode Launcher

Add this to your `~/.zshrc` or `~/.bashrc`:

```bash
# OpenCode shortcuts
alias oc='opencode'
alias ocu='opencode'  # For ultrawork tasks

# OpenCode with project context
ocp() {
  cd /path-to-project/meridiano-nestjs
  opencode "$@"
}
```

### Context Sharing

OpenCode can read your Cursor rules. Make sure your `.cursorrules` are comprehensive so OpenCode agents understand your project conventions.

## Practical Examples

### Example 1: Adding a New Feature

**Step 1 - Cursor**: Generate PRD
```
/generate-prd create a PRD for adding email notifications when articles are bookmarked
```

**Step 2 - Cursor**: Convert to Ralph format (optional)
```
/ralph convert tasks/prd-email-notifications.md to prd.json
```

**Step 3 - OpenCode**: Implement with orchestration
```bash
opencode
# "Implement email notifications for bookmarked articles ultrawork"
```

**Step 4 - Cursor**: Review and test
- Review the implementation
- Run tests
- Make quick adjustments

### Example 2: Large Refactoring

**Step 1 - Cursor**: Understand scope
```
"Show me all the places where we use direct database queries instead of services"
```

**Step 2 - OpenCode**: Execute refactoring
```bash
opencode
# "Refactor all direct database queries to use service layer ultrawork"
```

**Step 3 - Cursor**: Verify and fix edge cases
- Check for any missed cases
- Fix type errors
- Update tests

### Example 3: Multi-Agent Research

**OpenCode**: Deep research task
```bash
opencode
# "Research best practices for NestJS queue patterns and implement improvements ultrawork"
```

This will:
- Use Librarian to find official docs
- Use Explore to search codebase
- Use Oracle for architecture decisions
- Use Sisyphus to implement

## Tips for Success

### 1. Context Sharing
- Keep `.cursorrules` comprehensive
- OpenCode reads project structure automatically
- Both tools understand your codebase conventions

### 2. File Watching
- Cursor watches files automatically
- OpenCode changes appear in Cursor immediately
- No need to manually refresh

### 3. Git Workflow
- Use feature branches for both tools
- Commit Cursor changes separately from OpenCode changes
- Review all changes before merging

### 4. Error Handling
- Cursor: Quick fixes for type errors and linting
- OpenCode: Let agents handle complex error resolution
- Use Cursor to verify OpenCode's solutions

### 5. Testing
- Cursor: Quick test writing and debugging
- OpenCode: Comprehensive test suite generation
- Use Cursor to run and verify tests

## Common Workflows

### Daily Development
1. Start with Cursor for quick tasks
2. Switch to OpenCode for complex features
3. Return to Cursor for review and refinement

### Feature Development
1. **Planning**: Cursor chat + PRD generation
2. **Implementation**: OpenCode with `ultrawork`
3. **Review**: Cursor for code review
4. **Testing**: Cursor for test execution
5. **Refinement**: Cursor for quick fixes

### Bug Fixing
1. **Investigation**: Cursor for quick exploration
2. **Complex Fixes**: OpenCode if multi-file changes needed
3. **Simple Fixes**: Cursor for immediate resolution
4. **Verification**: Cursor for testing

## Integration Points

### Shared Context
- Both tools read from the same codebase
- `.cursorrules` inform both systems
- Git history is shared

### File System
- Both work on the same files
- Changes are immediately visible
- No conflicts if working on different files

### Terminal Integration
- OpenCode runs in terminal
- Cursor has integrated terminal
- Can run OpenCode from Cursor's terminal

## Troubleshooting

### Issue: OpenCode changes not visible in Cursor
**Solution**: Cursor auto-refreshes. If not, manually reload window (Cmd+R)

### Issue: Conflicts between tools
**Solution**: Use Git branches. Work on different features in each tool.

### Issue: OpenCode not understanding project structure
**Solution**: Ensure `.cursorrules` is comprehensive. OpenCode reads project files.

### Issue: Want to use ultrawork features in Cursor
**Solution**: Use Ralph instead, or switch to OpenCode for that specific task.

## Best Practices

1. **Start Simple**: Use Cursor for most tasks, OpenCode for complex ones
2. **Clear Boundaries**: Know when to switch tools
3. **Review Everything**: Always review OpenCode's work in Cursor
4. **Iterate**: Use both tools in an iterative workflow
5. **Document**: Keep notes on what works best for your workflow

## Quick Reference

| Task Type              | Tool     | Command/Keyword |
| ---------------------- | -------- | --------------- |
| Quick fix              | Cursor   | Direct chat     |
| Code review            | Cursor   | `@filename`     |
| Small refactor         | Cursor   | Direct chat     |
| Large refactor         | OpenCode | `ultrawork`     |
| Multi-file changes     | OpenCode | `ultrawork`     |
| Deep exploration       | OpenCode | `ultrawork`     |
| PRD-based work         | Cursor   | `/ralph`        |
| Background tasks       | OpenCode | `ultrawork`     |
| Architecture decisions | OpenCode | `ultrawork`     |

## Next Steps

1. Try the helper scripts above
2. Experiment with both tools on a small feature
3. Develop your own workflow patterns
4. Share what works with your team

Remember: Both tools are powerful. Use them together to maximize productivity!
