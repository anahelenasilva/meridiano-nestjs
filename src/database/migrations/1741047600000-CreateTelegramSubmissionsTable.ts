import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTelegramSubmissionsTable1741047600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telegram_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
        chat_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        message_id VARCHAR(255) NOT NULL,
        message_text TEXT,
        feed_profile VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        submission_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for analytics queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_submissions_chat_id 
      ON telegram_submissions(chat_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_submissions_created_at 
      ON telegram_submissions(created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_submissions_username 
      ON telegram_submissions(username)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_submissions_status 
      ON telegram_submissions(submission_status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_submissions_article_id 
      ON telegram_submissions(article_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_submissions_article_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_submissions_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_submissions_username`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_submissions_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_submissions_chat_id`);

    await queryRunner.query(`DROP TABLE IF EXISTS telegram_submissions`);
  }
}
