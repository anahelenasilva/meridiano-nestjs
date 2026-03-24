import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectorExtensionAndEmbeddingColumn1774000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(
      `ALTER TABLE articles ADD COLUMN embedding_vector vector(1024)`,
    );

    await queryRunner.query(`
      CREATE INDEX idx_articles_embedding_vector
      ON articles USING ivfflat (embedding_vector vector_cosine_ops)
      WITH (lists = 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_embedding_vector`);
    await queryRunner.query(
      `ALTER TABLE articles DROP COLUMN IF EXISTS embedding_vector`,
    );
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
