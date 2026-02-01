---
name: ralph-run
description: Execute Ralph autonomous agent iterations to implement user stories from a PRD. Use when running Ralph, working through prd.json stories, implementing PRD tasks iteratively, or when the user mentions Ralph or autonomous story implementation.
---

# Ralph Agent - Autonomous Story Implementation

Ralph is an autonomous coding agent that works through user stories in a PRD file iteratively, one story at a time.

## Quick Start

When executing a Ralph iteration:

1. Locate `scripts/ralph/prd.json` in the project
2. Read `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Follow the workflow below to implement the next story

## Ralph Workflow

### Step 1: Load Context

Read these files in order:
- `scripts/ralph/prd.json` - Contains user stories with priority and status
- `scripts/ralph/progress.txt` - Contains previous learnings and patterns

### Step 2: Select Next Story

Pick the **highest priority** user story where `passes: false`.

Priority sorting:
- Stories are ordered by their position in the array
- First incomplete story (passes: false) is highest priority

### Step 3: Branch Check

Verify you're on the correct branch from `prd.json` field `branchName`.

If branch doesn't exist:
```bash
git checkout -b [branchName]
```

If branch exists but not checked out:
```bash
git checkout [branchName]
```

### Step 4: Implement Story

Implement the selected user story following:
- Story acceptance criteria
- Existing code patterns (check progress.txt Codebase Patterns section)
- Project coding standards

Keep changes focused and minimal.

### Step 5: Quality Checks

Run project quality checks before committing:

```bash
pnpm run typecheck
pnpm run test
```

Adjust commands based on what the project uses (lint, build, etc.).

If checks fail, fix issues and re-run until all pass.

### Step 6: Update AGENTS.md (If Needed)

Before committing, check if edited files have learnings worth preserving:

1. Identify directories with edited files
2. Look for existing AGENTS.md files
3. Add valuable learnings if you discovered:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches

Examples of good additions:
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require dev server running on PORT 3000"

Do NOT add story-specific details or temporary notes.

### Step 7: Commit Changes

Commit all changes with this exact format:

```bash
git add .
git commit -m "feat: [Story ID] - [Story Title]"
```

Example:
```bash
git commit -m "feat: US-001 - Add user authentication"
```

### Step 8: Update PRD

Edit `scripts/ralph/prd.json` and set `passes: true` for the completed story.

### Step 9: Log Progress

APPEND to `scripts/ralph/progress.txt` (never replace):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

#### Consolidate Patterns

If you discovered a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
```

Only add patterns that are general and reusable, not story-specific details.

### Step 10: Browser Testing (Frontend Only)

For stories that change UI, verify in browser:

1. Start dev server
2. Navigate to relevant page
3. Verify UI changes work
4. Take screenshot for progress log if helpful

Frontend stories are NOT complete until browser-verified.

### Step 11: Check Completion

After completing a story, check if ALL stories in prd.json have `passes: true`.

**If all complete**, reply with:
```
<promise>COMPLETE</promise>
```

**If stories remain**, end response normally and wait for next iteration.

## Iteration Pattern

Each Ralph execution handles ONE story. Multiple iterations work through all stories sequentially.

Typical session:
1. Run Ralph iteration
2. Implement current story
3. Commit and update PRD
4. Run Ralph again for next story
5. Repeat until completion

## Quality Requirements

- ALL commits must pass quality checks
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
- Read Codebase Patterns in progress.txt before starting

## Common Issues

**No prd.json found**: Ralph requires a PRD file. Generate one using `/generate-prd` skill, then convert with `/ralph` skill.

**Quality checks fail**: Fix all issues before committing. Don't proceed until checks pass.

**Branch conflicts**: Ensure you're on the correct branch before starting implementation.

## Files Reference

- `scripts/ralph/prd.json` - Product Requirements Document with stories
- `scripts/ralph/progress.txt` - Progress log and learnings
- `scripts/ralph/.last-branch` - Tracks current branch
- `scripts/ralph/prompt.md` - Original Ralph instructions (reference)
- `scripts/ralph/README.md` - Ralph documentation (reference)

## Integration with Other Skills

Ralph works with these skills:
- `/generate-prd` - Create initial PRD document
- `/ralph` - Convert markdown PRD to prd.json format
- Ralph runs the workflow to implement stories

## Example Execution

```
User: /ralph-run

Agent:
[Reads prd.json and progress.txt]
[Identifies next story: US-001 - Add authentication]
[Checks branch: ralph/add-auth]
[Implements authentication]
[Runs tests - all pass]
[Commits changes]
[Updates prd.json: US-001 passes: true]
[Appends to progress.txt]
[Checks remaining stories - 3 more to go]

Done with iteration. 3 stories remaining.
```

## Tips for Effective Iterations

1. **Read progress.txt patterns first** - Avoid repeating mistakes
2. **One story at a time** - Don't try to batch stories
3. **Commit early** - Better to have small commits than large ones
4. **Update patterns** - Help future iterations by documenting learnings
5. **Keep CI green** - Never commit failing tests
6. **Trust the process** - Ralph works incrementally, let it

## Autonomous vs Manual Mode

Ralph can run:
- **Manually**: User triggers each iteration with `/ralph-run`
- **Autonomously**: User can request multiple iterations

In autonomous mode, continue executing iterations until:
- All stories complete (send `<promise>COMPLETE</promise>`)
- Max iterations reached
- User intervention needed (ask for clarification)
