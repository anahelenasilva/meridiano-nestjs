import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateBriefingArticleIds1767142045058 implements MigrationInterface {
  name = 'MigrateBriefingArticleIds1767142045058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a temporary column to store the old article_ids for rollback
    await queryRunner.query(`
      ALTER TABLE briefings
      ADD COLUMN article_ids_old TEXT
    `);

    await queryRunner.query(`
      UPDATE briefings
      SET article_ids_old = article_ids
    `);

    // Update article_ids: convert from integer array to UUID array
    // This uses a complex query that:
    // 1. Parses the JSON array of integer IDs
    // 2. Joins with articles table to get corresponding UUIDs
    // 3. Builds a new JSON array of UUIDs
    await queryRunner.query(`
      UPDATE briefings b
      SET article_ids = (
        SELECT json_agg(a.id_uuid)::text
        FROM articles a
        WHERE a.id = ANY(
          SELECT jsonb_array_elements_text(b.article_ids::jsonb)::integer
        )
      )
      WHERE article_ids IS NOT NULL
      AND article_ids != '[]'
      AND article_ids != 'null'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE briefings
      SET article_ids = article_ids_old
      WHERE article_ids_old IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE briefings
      DROP COLUMN article_ids_old
    `);
  }
}
