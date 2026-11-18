---
requires:
  - Test and Lint
waitsForTimeout: 20
---
This is a NestJS + TypeORM + Postgres API with BullMQ on Redis, and AI calls
to DeepSeek and OpenAI. CI already enforces lint, typecheck, lib import
boundaries (dependency-cruiser), file layout, immutable migrations and
openapi.json drift. Do not comment on formatting, import paths into libs/,
or openapi.json content.

Postgres is the only database. Do not suggest SQLite or MySQL handling.

Raw SQL through DatabaseService (libs/database) uses `?` placeholders on
purpose: convertPlaceholders in libs/database/database.service.ts numbers
every `?` into $1, $2 before pg runs it. It does not parse the SQL, so a
literal `?` inside a string (LIKE '%?%') or a jsonb operator (? ?| ?&) gets
numbered too and shifts every later parameter.

Flat modules that keep their logic in a service (bookmarks, scraper, users)
are intentional. A controller that calls a service directly, with no
command or usecase in between, is intentional. Do not suggest adding layers.

A Prettier hook runs on every file an agent edits, so a PR can carry
whitespace-only hunks in lines it did not otherwise change. Do not comment
on them.

The dummy API keys in .github/workflows/pr-checks.yml (e2e job env) are
intentional placeholders, not leaked secrets.

An already-run migration in src/database/migrations may be edited only on a
PR with the migration-edit label, and the PR body explains why.
