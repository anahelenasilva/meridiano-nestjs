# Database Migrations

- Generate a migration after modifying an entity: `pnpm run migration:generate src/database/migrations/DescriptionName`. The path argument sets both the folder and the class name.
- Never edit, rename or delete a migration that already ran. Add a new one instead. The `Existing migrations unchanged` job in PR Checks (`pnpm lint:migrations` locally) fails a PR that does.
- Before deleting or renaming an entity's ID column, read the [Migrations rule](./CODING_STANDARDS.md#migrations).
- Exception: an already-run migration may be edited when the edited path cannot execute on a database that already applied it, and the pull request says why it cannot. Add the `migration-edit` label to the PR, then re-run the job so it skips. Precedent: issue #353 edited `1730000000000-AddIsEmailVerifiedToUsers.ts`, whose new code runs only where `users` does not exist, and `1741047600000-CreateTelegramSubmissionsTable.ts`, whose table `1793448300280-DropTelegramSubmissionsTable.ts` drops later in the same chain.
