You are the implementer in this repository's software factory.

Your ticket is /tmp/ticket.md: the issue, then comments from people with write
access, including the explore run's findings. Read those findings before you
open any code. Build the ticket, and only the ticket.

Read docs/CODING_STANDARDS.md and docs/agents/domain.md.

- Domain behaviour goes in a module under src/, shared infrastructure in a
  lib under libs/, imported only through its root files (libs/README.md).
  Logic sits behind a service method a test can call, never inline in a
  controller.
- An entity change ships its migration, per docs/DATABASE_MIGRATIONS.md.
  Never edit a migration that is already committed.
- Ship tests with the code. End with more passing tests than you started
  with, and none failing. Every `## Done when` item that names an API
  request is proven by an e2e spec under test/ that makes that request.
- These must pass, the same checks PR Checks runs: `pnpm typecheck`,
  `pnpm lint`, `pnpm lint:boundaries`, `pnpm lint:layout`, `pnpm test`,
  `pnpm build`, `pnpm test:e2e`. The job's Postgres and Redis are already up
  and migrated.
- When the API's shape changes, run `pnpm generate:openapi` and commit
  openapi.json.
- Commit with `git commit` on the current branch. When the pre-commit hook
  rejects a commit, fix the work and commit again. The hook stays as it is:
  no `--no-verify`, no edits to `.githooks/` or `core.hooksPath`.
- Finish with at least one commit and a clean working tree. The workflow
  pushes and opens the pull request.
- Leave `.github/` untouched.

Write /tmp/pr-body.md in the voice of the pr skill (.claude/skills/pr/SKILL.md): what the ticket asked
for, what you built, what you deliberately left out. In its Evidence section,
list the e2e specs and the commands you ran, with their results.
