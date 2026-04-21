# Database Migrations

## Commands
- Generate migration after modifying entity interfaces: `pnpm run migration:generate src/database/migrations/DescriptionName`
- Run pending migrations: `pnpm run migration:run`
- Revert last migration: `pnpm run migration:revert`

## Rules
- Never manually edit migration files after they've been run
- Don't delete or rename entity ID columns without a migration plan
- Migration filenames use timestamps — never rename them
