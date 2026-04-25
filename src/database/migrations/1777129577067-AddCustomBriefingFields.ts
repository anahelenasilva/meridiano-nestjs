import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomBriefingFields1777129577067 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE briefings ADD COLUMN is_custom BOOLEAN DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE briefings ADD COLUMN custom_title TEXT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE briefings DROP COLUMN custom_title`,
    );
    await queryRunner.query(
      `ALTER TABLE briefings DROP COLUMN is_custom`,
    );
  }
}
