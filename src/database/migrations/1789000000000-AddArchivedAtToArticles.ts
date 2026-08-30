import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArchivedAtToArticles1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL
    `);

    // Partial on the non-null side: the archived set is the small one, and an
    // index covering archived_at IS NULL would match nearly every row.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_archived
      ON articles(archived_at DESC)
      WHERE archived_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_archived`);
    await queryRunner.query(
      `ALTER TABLE articles DROP COLUMN IF EXISTS archived_at`,
    );
  }
}
