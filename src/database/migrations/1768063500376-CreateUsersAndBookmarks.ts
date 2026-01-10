import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersAndBookmarks1768063500376 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Create bookmarks table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                article_id UUID NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_bookmark_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_bookmark_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_article UNIQUE (user_id, article_id)
            )
        `);

    // Create indexes for better query performance
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_bookmarks_article_id ON bookmarks(article_id)
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC)
        `);

    // Seed initial user (only if doesn't exist)
    await queryRunner.query(`
            INSERT INTO users (email, username)
            VALUES ('anahelenarp@hotmail.com', 'anahelena')
            ON CONFLICT (email) DO NOTHING
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookmarks_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookmarks_article_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookmarks_user_id`);

    // Drop bookmarks table (must be before users due to foreign key constraint)
    await queryRunner.query(`DROP TABLE IF EXISTS bookmarks`);

    // Drop users table
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }

}
