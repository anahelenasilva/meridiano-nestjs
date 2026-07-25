import { FeedProfile } from '../../shared/types/feed';

export const FEED_DEFAULT_ITEM_LIMIT = 20;
export const FEED_MAX_ITEM_LIMIT = 100;

const VALID_FEED_PROFILES = new Set<string>(Object.values(FeedProfile));

export function parseFeedLimit(value: string | undefined): number {
  if (typeof value !== 'string' || value.trim() === '') {
    return FEED_DEFAULT_ITEM_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return FEED_DEFAULT_ITEM_LIMIT;
  }

  return Math.min(parsed, FEED_MAX_ITEM_LIMIT);
}

export function parseFeedProfile(
  value: string | undefined,
): FeedProfile | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  return VALID_FEED_PROFILES.has(normalized)
    ? (normalized as FeedProfile)
    : undefined;
}
