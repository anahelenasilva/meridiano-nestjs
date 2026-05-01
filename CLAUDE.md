# Agent Mode Instructions

## Tech Stack
- NestJS 11, TypeScript 5.9, Node.js 22
- PostgreSQL, TypeORM 0.3.20
- Redis, BullMQ 5, ioredis
- AWS S3 (`@aws-sdk`)
- pnpm 10

## Package Manager
- **Always use `pnpm`**, never `npm` or `yarn`
- Install packages: `pnpm add <package>` or `pnpm add -D <package>`
- Run scripts: `pnpm run <script>`

## Testing Standards
- When updating a testing file or creating a test, use [TESTING_STANDARDS](./docs/TESTING_STANDARDS.md)

## Database Migrations
- When modifying entities or working with migrations, use [DATABASE_MIGRATIONS](./docs/DATABASE_MIGRATIONS.md)

## Architecture Patterns
- When creating modules, organizing code structure, or implementing CQRS, use [ARCHITECTURE_PATTERNS](./docs/ARCHITECTURE_PATTERNS.md)

## Coding Standards
- When writing or reviewing code, use [CODING_STANDARDS](./docs/CODING_STANDARDS.md)

## When to Ask
Stop and ask before:
- Adding new dependencies
- Modifying DB schema or migrations
- Changing public API contracts
- Architectural decisions not covered by this file

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` at root + `docs/adr/`. See `docs/agents/domain.md`.
