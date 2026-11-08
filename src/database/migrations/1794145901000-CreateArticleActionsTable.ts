import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticleActionsTable1794145901000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS article_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id UUID NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
        disposition TEXT NOT NULL CHECK (disposition IN ('reference_only','connect_to_note','experiment','task','verify_claim')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        rationale TEXT NOT NULL,
        proposal JSONB NULL,
        status TEXT NOT NULL CHECK (status IN ('reference','proposed','dismissed','executing','executed','failed')),
        downgraded_from TEXT NULL,
        external_ref TEXT NULL,
        error TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (status <> 'executed' OR external_ref IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS article_actions`);
  }
}
