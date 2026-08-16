import { MigrationInterface, QueryRunner } from 'typeorm';
import { resolveChannelIds } from '../../youtube-transcriptions/helpers/resolve-channel-ids';

/**
 * Replaces the denormalized `channel_id`/`channel_name` text on
 * `youtube_transcriptions` with a real foreign key to `youtube_channels(id)`.
 *
 * The backfill translates any row still keyed by an external YouTube id to the
 * owning channel's internal UUID (which also consolidates the split
 * Augusto Galego / PewDiePie channels). If any `channel_id` maps to no channel
 * the migration throws, and TypeORM's `transaction: 'all'` rolls the whole
 * thing back so the FK is never enforced over corrupt data.
 */
export class AddChannelFkToTranscriptions1787000000000
  implements MigrationInterface
{
  name = 'AddChannelFkToTranscriptions1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const channels: { id: string; channelId: string }[] =
      await queryRunner.query(
        `SELECT id, channel_id AS "channelId" FROM youtube_channels`,
      );

    const storedRows: { channel_id: string }[] = await queryRunner.query(
      `SELECT DISTINCT channel_id FROM youtube_transcriptions`,
    );
    const storedChannelIds = storedRows.map((row) => row.channel_id);

    const { resolved, orphans } = resolveChannelIds(storedChannelIds, channels);

    if (orphans.length > 0) {
      throw new Error(
        `Cannot add channel FK: ${orphans.length} transcription channel_id(s) resolve to no channel: ${orphans.join(', ')}`,
      );
    }

    // Rows already holding an internal id resolve to themselves; only the
    // external-id rows need rewriting to the channel's internal UUID.
    for (const [stored, internalId] of resolved) {
      if (stored !== internalId) {
        await queryRunner.query(
          `UPDATE youtube_transcriptions SET channel_id = $1 WHERE channel_id = $2`,
          [internalId, stored],
        );
      }
    }

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions
         ALTER COLUMN channel_id TYPE UUID USING channel_id::uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions
         ADD CONSTRAINT fk_youtube_transcriptions_channel
         FOREIGN KEY (channel_id) REFERENCES youtube_channels(id)`,
    );

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions DROP COLUMN channel_name`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions ADD COLUMN channel_name TEXT`,
    );

    // Re-denormalize the name from the channels table before restoring the
    // NOT NULL constraint the original schema had.
    await queryRunner.query(
      `UPDATE youtube_transcriptions yt
         SET channel_name = c.name
         FROM youtube_channels c
         WHERE c.id = yt.channel_id`,
    );

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions ALTER COLUMN channel_name SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions
         DROP CONSTRAINT fk_youtube_transcriptions_channel`,
    );

    await queryRunner.query(
      `ALTER TABLE youtube_transcriptions
         ALTER COLUMN channel_id TYPE TEXT USING channel_id::text`,
    );
  }
}
