import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotesTable1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('article', 'transcription')),
        source_id UUID NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_source_lookup ON notes(source_type, source_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_unique_active_owner_source
      ON notes(user_id, source_type, source_id)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notes_unique_active_owner_source`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notes_deleted_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notes_source_lookup`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notes_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS notes`);
  }
}
