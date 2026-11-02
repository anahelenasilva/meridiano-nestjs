import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsEmailVerifiedToUsers1730000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // On an empty database this runs 9 migrations before
    // 1768063500376-CreateUsersAndBookmarks creates `users`, so there is
    // nothing to alter yet. The column is not lost: migration
    // 1793643992565-AddIsEmailVerifiedToUsersOnFreshSchema adds it at the end
    // of the chain.
    const [{ exists }] = await queryRunner.query(
      `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
    );
    if (!exists) {
      return;
    }

    await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN is_email_verified BOOLEAN DEFAULT false
        `);

    // Set all existing users as email verified (since they were created without email verification)
    await queryRunner.query(`
            UPDATE users
            SET is_email_verified = true
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN is_email_verified
        `);
  }
}
