import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces the column 1730000000000-AddIsEmailVerifiedToUsers cannot add on an
// empty database, where it runs before `users` exists. `IF NOT EXISTS` keeps
// this a no-op on every database that already applied that migration.
export class AddIsEmailVerifiedToUsersOnFreshSchema1793643992565
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false
        `);
  }

  // Asymmetric on purpose. Every database that ran
  // 1730000000000-AddIsEmailVerifiedToUsers got the column from there, and that
  // migration's own down() drops it. Dropping it here would take the column off
  // a schema this migration never touched.
  public down(): Promise<void> {
    return Promise.resolve();
  }
}
