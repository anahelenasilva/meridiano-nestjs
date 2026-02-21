import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1735027200000 implements MigrationInterface {
  name = 'InitialSchema1735027200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // articles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        published_date TIMESTAMP NOT NULL,
        feed_source TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        processed_content TEXT,
        embedding TEXT,
        impact_rating INTEGER,
        feed_profile TEXT NOT NULL,
        image_url TEXT,
        categories TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // briefings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS briefings (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        article_ids TEXT NOT NULL,
        feed_profile TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // youtube_transcriptions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS youtube_transcriptions (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        video_title TEXT NOT NULL,
        posted_at TEXT NULL,
        video_url TEXT UNIQUE NOT NULL,
        processed_at TIMESTAMP NOT NULL,
        transcription_text TEXT NOT NULL,
        transcription_summary TEXT NULL,
        transcription_analysis TEXT NULL,
        transcription_cassification TEXT NULL,
        thumbnail_url TEXT NULL
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_feed_profile
      ON articles(feed_profile)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_published_date
      ON articles(published_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_feed_profile_date
      ON articles(feed_profile, published_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_briefings_feed_profile
      ON briefings(feed_profile)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_briefings_created_at
      ON briefings(created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_channel_id
      ON youtube_transcriptions(channel_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_processed_at
      ON youtube_transcriptions(processed_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_youtube_processed_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_youtube_channel_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_briefings_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_briefings_feed_profile`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_articles_feed_profile_date`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_published_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_feed_profile`);

    await queryRunner.query(`DROP TABLE IF EXISTS youtube_transcriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS briefings`);
    await queryRunner.query(`DROP TABLE IF EXISTS articles`);
  }
}
