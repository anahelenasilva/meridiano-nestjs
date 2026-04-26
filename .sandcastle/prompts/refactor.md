# Context

!`git log --oneline -5`

# Task

Read `docs/CODING_STANDARDS.md` in full before writing anything.

<!-- List the files to refactor below — the agent must not touch anything else -->
**Files in scope:**
TODO: list the files to refactor here before running this prompt.

Refactoring rules:
- Touch ONLY the files listed above — no other files
- Do NOT change existing public API contracts (exported function signatures, controller routes, DTO shapes, exported service methods)
- Do NOT introduce new abstractions unless they are documented with a comment explaining why
- Follow all rules in `docs/CODING_STANDARDS.md`: error handling, comment policy, parameter propagation
- Use conventional commits: `refactor:`

Run `pnpm test` after each file change. Fix any failures before moving to the next file.

# Done

When all listed files are refactored and tests pass, output <promise>COMPLETE</promise>.
