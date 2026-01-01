import { MigrationInterface, QueryRunner } from 'typeorm';

export class PopulateUuidColumns1767142031931 implements MigrationInterface {
  name = 'PopulateUuidColumns1767142031931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Generate UUIDs for all existing records in articles table
    await queryRunner.query(`
      UPDATE articles
      SET id_uuid = gen_random_uuid()
      WHERE id_uuid IS NULL
    `);

    // Generate UUIDs for all existing records in briefings table
    await queryRunner.query(`
      UPDATE briefings
      SET id_uuid = gen_random_uuid()
      WHERE id_uuid IS NULL
    `);

    // Generate UUIDs for all existing records in youtube_transcriptions table
    await queryRunner.query(`
      UPDATE youtube_transcriptions
      SET id_uuid = gen_random_uuid()
      WHERE id_uuid IS NULL
    `);

    // Make id_uuid NOT NULL after populating
    await queryRunner.query(`
      ALTER TABLE articles
      ALTER COLUMN id_uuid SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE briefings
      ALTER COLUMN id_uuid SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions
      ALTER COLUMN id_uuid SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Allow NULL again
    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions
      ALTER COLUMN id_uuid DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE briefings
      ALTER COLUMN id_uuid DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE articles
      ALTER COLUMN id_uuid DROP NOT NULL
    `);

    // Set all UUIDs back to NULL (data will be lost, but this is rollback)
    await queryRunner.query(`UPDATE youtube_transcriptions SET id_uuid = NULL`);
    await queryRunner.query(`UPDATE briefings SET id_uuid = NULL`);
    await queryRunner.query(`UPDATE articles SET id_uuid = NULL`);
  }
}
