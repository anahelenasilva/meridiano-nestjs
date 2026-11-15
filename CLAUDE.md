# General repo rules

- When writing or reviewing code, use [CODING_STANDARDS](./docs/CODING_STANDARDS.md)
- When an e2e suite hangs or you touch `test/jest-e2e.json`, read [TESTING_STANDARDS](./docs/TESTING_STANDARDS.md)
- Before importing from or adding a lib in `libs/`, read [libs/README](./libs/README.md#import-conventions): import a lib only through its root files
- When modifying entities or working with migrations, use [DATABASE_MIGRATIONS](./docs/DATABASE_MIGRATIONS.md)
- Before exploring the codebase, or when naming a domain concept, read [domain](./docs/agents/domain.md)
- When creating, reading, or commenting on an issue, or titling a PR, use [issue-tracker](./docs/agents/issue-tracker.md)
- When applying a triage label to an issue, use [triage-labels](./docs/agents/triage-labels.md)
- Before opening a PR, run `pnpm check:boot` in the worktree (link `.env` from the main checkout first). If it fails, run `pnpm check:boot <main checkout>`: if main fails too, the break predates the branch, so report it instead of fixing it in the branch. Use this script, not `pnpm start:dev`, since it picks a free port and always kills the server
