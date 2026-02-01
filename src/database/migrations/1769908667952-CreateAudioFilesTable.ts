import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAudioFilesTable1769908667952 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type TEXT NOT NULL CHECK (source_type IN ('article', 'transcription')),
        source_id UUID NOT NULL,
        s3_bucket TEXT NOT NULL,
        s3_key TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        duration_seconds REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_audio_source UNIQUE (source_type, source_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_source_type ON audio_files(source_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_source_id ON audio_files(source_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_created_at ON audio_files(created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audio_files_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audio_files_source_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audio_files_source_type`);

    await queryRunner.query(`DROP TABLE IF EXISTS audio_files`);
  }

}
