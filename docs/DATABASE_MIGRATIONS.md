# Database Migrations

## Commands
- Generate migration after modifying entity interfaces: `pnpm run migration:generate src/database/migrations/DescriptionName`
- Run pending migrations: `pnpm run migration:run`
- Revert last migration: `pnpm run migration:revert`

## Rules
- Never manually edit migration files after they've been run
- Don't delete or rename entity ID columns without a migration plan
- Migration filenames use timestamps — never rename them
- A migration must apply to an empty database. The `e2e` job in `.github/workflows/pr-checks.yml` checks this on every PR
- Exception to "Never manually edit migration files after they've been run": an already-run migration may be edited when the edited path cannot execute on a database that already applied it, and the pull request says why it cannot. Precedent: issue #353 edited `1730000000000-AddIsEmailVerifiedToUsers.ts`, whose new code runs only where `users` does not exist, and `1741047600000-CreateTelegramSubmissionsTable.ts`, whose table `1793448300280-DropTelegramSubmissionsTable.ts` drops later in the same chain
