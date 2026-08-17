/**
 * Backfill resolver for seed-time channel -> starter-category associations.
 *
 * The explicit mapping is keyed by the external YouTube channel id (not the
 * internal UUID), since that is the only stable identifier available ahead of
 * time. A mapped channel absent from the local `youtube_channels` table is
 * skipped rather than erroring, so the same migration works unmodified across
 * environments that only have a subset of the known channels.
 */

export interface ChannelCategoryMapping {
  /** External YouTube channel id (youtube_channels.channel_id). */
  channelId: string;
  categoryNames: string[];
}

export interface ChannelRow {
  /** Internal channel UUID (youtube_channels.id). */
  id: string;
  /** External YouTube channel id (youtube_channels.channel_id). */
  channelId: string;
}

export interface CategoryRow {
  id: string;
  name: string;
}

export interface ChannelCategoryPair {
  /** Internal channel UUID. */
  channelId: string;
  categoryId: string;
}

export function resolveChannelCategoryBackfill(
  mappings: readonly ChannelCategoryMapping[],
  channels: readonly ChannelRow[],
  categories: readonly CategoryRow[],
): ChannelCategoryPair[] {
  const internalIdByExternalChannelId = new Map(
    channels.map((channel) => [channel.channelId, channel.id] as const),
  );
  const categoryIdByLowerName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id] as const),
  );

  const pairs: ChannelCategoryPair[] = [];

  for (const mapping of mappings) {
    const internalChannelId = internalIdByExternalChannelId.get(mapping.channelId);
    if (!internalChannelId) continue;

    for (const categoryName of mapping.categoryNames) {
      const categoryId = categoryIdByLowerName.get(categoryName.toLowerCase());
      if (!categoryId) continue;

      pairs.push({ channelId: internalChannelId, categoryId });
    }
  }

  return pairs;
}
