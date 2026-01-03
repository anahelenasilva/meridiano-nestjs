import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateYoutubeChannelsTable1767438278000 implements MigrationInterface {
  name = 'CreateYoutubeChannelsTable1767438278000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS youtube_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT false NOT NULL,
        max_videos INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id
      ON youtube_channels(channel_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_channels_enabled
      ON youtube_channels(enabled)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_youtube_channels_enabled`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_youtube_channels_channel_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS youtube_channels`);
  }
}

