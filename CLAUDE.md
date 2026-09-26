# General repo rules

- Always check the comments that you make on changes: are they useful for future humans and future agents reading them? Do those comments just state what the code does? If they aren't useful and/or just state what the code does, drop them
- When writing or reviewing code, use [CODING_STANDARDS](./docs/CODING_STANDARDS.md)
- When updating a testing file or creating a test, use [TESTING_STANDARDS](./docs/TESTING_STANDARDS.md)
- When modifying entities or working with migrations, use [DATABASE_MIGRATIONS](./docs/DATABASE_MIGRATIONS.md)
- Before exploring the codebase, or when naming a domain concept, read [domain](./docs/agents/domain.md)
- When creating, reading, or commenting on an issue, use [issue-tracker](./docs/agents/issue-tracker.md)
- When applying a triage label to an issue, use [triage-labels](./docs/agents/triage-labels.md)
- Before opening a PR, run `pnpm check:boot` in the worktree (link `.env` from the main checkout first). If it fails, run `pnpm check:boot <main checkout>`: if main fails too, the break predates the branch, so report it instead of fixing it in the branch. Use this script, not `pnpm start:dev`, since it picks a free port and always kills the server
