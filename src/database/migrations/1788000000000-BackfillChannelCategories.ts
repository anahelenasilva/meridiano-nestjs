import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ChannelCategoryMapping,
  resolveChannelCategoryBackfill,
} from '../../youtube-channels/helpers/resolve-channel-category-backfill';

/**
 * Backfills `channel_categories` for the known channels so a fresh (or
 * existing) install shows them already grouped under the starter categories,
 * instead of requiring an admin to tag each one by hand.
 *
 * Mirrors SeedCategories's `INSERT ... ON CONFLICT DO NOTHING` shape: one-shot,
 * idempotent, and never touches an existing `channel_categories` row, so
 * admin-made associations and re-runs are both safe. A mapped channel absent
 * from the local `youtube_channels` table is skipped, never an error.
 */
const STARTER_CATEGORY_MAPPING: ChannelCategoryMapping[] = [
  { channelId: 'UCbRP3c757lWg9M-U7TyEkXA', categoryNames: ['tech', 'AI'] }, // Theo Browne
  { channelId: 'UCQM428Hwrvxla8DCgjGONSQ', categoryNames: ['tech'] }, // JavaScript Conferences by GitNation
  { channelId: 'UCLW51-XEzuOm5RwPMChHBMw', categoryNames: ['tech'] }, // Augusto Galego
];

export class BackfillChannelCategories1788000000000
  implements MigrationInterface
{
  name = 'BackfillChannelCategories1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { pairs, unmatchedCategoryNames } = await resolvePairs(queryRunner);

    // Unlike a missing channel, an unmatched category name means a typo in
    // this file's own mapping (the starter categories always exist by this
    // point) -> fail loud instead of silently seeding nothing for that entry.
    if (unmatchedCategoryNames.length > 0) {
      throw new Error(
        `Cannot backfill channel categories: ${unmatchedCategoryNames.length} category name(s) in STARTER_CATEGORY_MAPPING match no known category: ${unmatchedCategoryNames.join(', ')}`,
      );
    }

    for (const pair of pairs) {
      await queryRunner.query(
        `INSERT INTO channel_categories (channel_id, category_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [pair.channelId, pair.categoryId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Blunt by design, mirroring SeedCategories's down: this removes exactly
    // the rows this mapping produces, even if an admin independently created
    // the identical association by hand.
    const { pairs } = await resolvePairs(queryRunner);

    for (const pair of pairs) {
      await queryRunner.query(
        `DELETE FROM channel_categories WHERE channel_id = $1 AND category_id = $2`,
        [pair.channelId, pair.categoryId],
      );
    }
  }
}

async function resolvePairs(queryRunner: QueryRunner) {
  const channels: { id: string; channelId: string }[] = await queryRunner.query(
    `SELECT id, channel_id AS "channelId" FROM youtube_channels`,
  );
  const categories: { id: string; name: string }[] = await queryRunner.query(
    `SELECT id, name FROM categories`,
  );

  return resolveChannelCategoryBackfill(
    STARTER_CATEGORY_MAPPING,
    channels,
    categories,
  );
}
