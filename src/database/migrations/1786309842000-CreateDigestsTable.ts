import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDigestsTable1786309842000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS digests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        items TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_digests_created_at ON digests(created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_digests_created_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS digests`);
  }
}
