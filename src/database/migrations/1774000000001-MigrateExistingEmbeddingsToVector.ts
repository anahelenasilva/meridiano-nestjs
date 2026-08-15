import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateExistingEmbeddingsToVector1774000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; embedding: string }[] = await queryRunner.query(
      `SELECT id, embedding FROM articles WHERE embedding IS NOT NULL AND embedding_vector IS NULL`,
    );

    let migratedCount = 0;

    for (const row of rows) {
      try {
        const parsed: number[] = JSON.parse(row.embedding);

        if (!Array.isArray(parsed) || parsed.length === 0) {
          continue;
        }

        const vectorLiteral = `[${parsed.join(',')}]`;
        await queryRunner.query(
          `UPDATE articles SET embedding_vector = $1::vector WHERE id = $2`,
          [vectorLiteral, row.id],
        );
        migratedCount++;
      } catch {
        console.warn(
          `Skipping article ${row.id}: failed to parse embedding JSON`,
        );
      }
    }

    console.log(
      `Migrated ${migratedCount} of ${rows.length} embeddings to vector column`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE articles SET embedding_vector = NULL WHERE embedding_vector IS NOT NULL`,
    );
  }
}
