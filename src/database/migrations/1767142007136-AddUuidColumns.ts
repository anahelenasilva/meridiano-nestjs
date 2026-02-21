import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUuidColumns1767142007136 implements MigrationInterface {
  name = 'AddUuidColumns1767142007136';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      ALTER TABLE articles
      ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid()
    `);

    await queryRunner.query(`
      ALTER TABLE briefings
      ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid()
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions
      ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid()
    `);

    // Create indexes on UUID columns for performance
    await queryRunner.query(`
      CREATE INDEX idx_articles_uuid ON articles(id_uuid)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_briefings_uuid ON briefings(id_uuid)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_youtube_transcriptions_uuid ON youtube_transcriptions(id_uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_youtube_transcriptions_uuid`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_briefings_uuid`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_uuid`);

    // Drop UUID columns
    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions DROP COLUMN IF EXISTS id_uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE briefings DROP COLUMN IF EXISTS id_uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE articles DROP COLUMN IF EXISTS id_uuid`,
    );
  }
}
