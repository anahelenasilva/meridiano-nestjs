# Context

!`git log --oneline -5`

!`git diff main...HEAD --name-only`

# Task

Read `docs/ARCHITECTURE_PATTERNS.md` and `docs/CODING_STANDARDS.md` in full before writing anything.

<!-- Replace the lines below with the feature description -->
**Feature to implement:**
TODO: describe the feature here before running this prompt.

Implementation rules:
- Follow the CQRS pattern: commands in `commands/*.command.ts`, queries in `queries/*.query.ts`, complex orchestration in `usecases/`
- All commands/queries/usecases are `@Injectable()` classes with an `execute()` method
- Domain modules go in `src/`, shared infrastructure goes in `libs/`
- Use `@libs/*` path aliases — never relative paths like `../../libs/`
- Do NOT generate or run database migrations — add a `// TODO: migration needed` comment on any entity field that requires one
- Do NOT change existing public API contracts (controller routes, DTO shapes, exported service methods)
- Follow all error handling rules from `docs/CODING_STANDARDS.md`: no silent nulls, no empty catch blocks
- Use conventional commits: `feat:`, `fix:`, `refactor:`

Run `pnpm test` after implementation. Fix any failures before finishing.

# Done

When implementation is complete and tests pass, output <promise>COMPLETE</promise>.
