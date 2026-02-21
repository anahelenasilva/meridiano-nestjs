import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsEmailVerifiedToUsers1730000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
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
