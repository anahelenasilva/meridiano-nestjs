import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceIdWithUuid1767142059182 implements MigrationInterface {
  name = 'ReplaceIdWithUuid1767142059182';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create backup tables for rollback capability
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS articles_id_backup AS
      SELECT id as old_id, id_uuid as new_uuid FROM articles
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS briefings_id_backup AS
      SELECT id as old_id, id_uuid as new_uuid FROM briefings
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS youtube_transcriptions_id_backup AS
      SELECT id as old_id, id_uuid as new_uuid FROM youtube_transcriptions
    `);

    // ARTICLES TABLE
    await queryRunner.query(`
      ALTER TABLE articles DROP CONSTRAINT articles_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE articles DROP COLUMN id
    `);

    await queryRunner.query(`
      ALTER TABLE articles RENAME COLUMN id_uuid TO id
    `);

    await queryRunner.query(`
      ALTER TABLE articles ADD PRIMARY KEY (id)
    `);

    // Drop the UUID index (no longer needed since it's now PK)
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_articles_uuid
    `);

    // BRIEFINGS TABLE
    await queryRunner.query(`
      ALTER TABLE briefings DROP CONSTRAINT briefings_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE briefings DROP COLUMN id
    `);

    await queryRunner.query(`
      ALTER TABLE briefings RENAME COLUMN id_uuid TO id
    `);

    await queryRunner.query(`
      ALTER TABLE briefings ADD PRIMARY KEY (id)
    `);

    // Drop the UUID index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_briefings_uuid
    `);

    // Drop the article_ids_old backup column
    await queryRunner.query(`
      ALTER TABLE briefings DROP COLUMN IF EXISTS article_ids_old
    `);

    // YOUTUBE_TRANSCRIPTIONS TABLE
    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions DROP CONSTRAINT youtube_transcriptions_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions DROP COLUMN id
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions RENAME COLUMN id_uuid TO id
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions ADD PRIMARY KEY (id)
    `);

    // Drop the UUID index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_youtube_transcriptions_uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: This rollback is complex and may result in data loss if new records were created
    // It attempts to restore the old integer IDs from backup tables

    // ARTICLES TABLE
    await queryRunner.query(`
      ALTER TABLE articles DROP CONSTRAINT articles_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE articles RENAME COLUMN id TO id_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE articles ADD COLUMN id SERIAL
    `);

    // Try to restore old IDs where possible (this will fail for new records)
    await queryRunner.query(`
      UPDATE articles a
      SET id = b.old_id
      FROM articles_id_backup b
      WHERE a.id_uuid = b.new_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE articles ADD PRIMARY KEY (id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_articles_uuid ON articles(id_uuid)
    `);

    // BRIEFINGS TABLE
    await queryRunner.query(`
      ALTER TABLE briefings DROP CONSTRAINT briefings_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE briefings RENAME COLUMN id TO id_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE briefings ADD COLUMN id SERIAL
    `);

    await queryRunner.query(`
      UPDATE briefings b
      SET id = bk.old_id
      FROM briefings_id_backup bk
      WHERE b.id_uuid = bk.new_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE briefings ADD PRIMARY KEY (id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_briefings_uuid ON briefings(id_uuid)
    `);

    // YOUTUBE_TRANSCRIPTIONS TABLE
    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions DROP CONSTRAINT youtube_transcriptions_pkey
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions RENAME COLUMN id TO id_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions ADD COLUMN id SERIAL
    `);

    await queryRunner.query(`
      UPDATE youtube_transcriptions yt
      SET id = ytb.old_id
      FROM youtube_transcriptions_id_backup ytb
      WHERE yt.id_uuid = ytb.new_uuid
    `);

    await queryRunner.query(`
      ALTER TABLE youtube_transcriptions ADD PRIMARY KEY (id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_youtube_transcriptions_uuid ON youtube_transcriptions(id_uuid)
    `);

    // Drop backup tables
    await queryRunner.query(
      `DROP TABLE IF EXISTS youtube_transcriptions_id_backup`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS briefings_id_backup`);
    await queryRunner.query(`DROP TABLE IF EXISTS articles_id_backup`);
  }
}
