import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesTables1786914346000 implements MigrationInterface {
  name = 'CreateCategoriesTables1786914346000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Case-insensitive uniqueness: "Tech" and "tech" collide, but the original
    // casing stays in `name` for display.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_lower
      ON categories (LOWER(name))
    `);

    // Deleting a category (or a channel) drops its join rows via ON DELETE
    // CASCADE and never touches the referenced channel/category row.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channel_categories (
        channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (channel_id, category_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_categories_channel_id
      ON channel_categories(channel_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_categories_category_id
      ON channel_categories(category_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_channel_categories_category_id`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_channel_categories_channel_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS channel_categories`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_categories_name_lower`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories`);
  }
}
