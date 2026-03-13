import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomPromptToArticlesAndYoutubeTranscriptions1773365775456
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE articles ADD COLUMN custom_prompt TEXT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions ADD COLUMN custom_prompt TEXT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions DROP COLUMN custom_prompt`,
    );
    await queryRunner.query(`ALTER TABLE articles DROP COLUMN custom_prompt`);
  }
}
