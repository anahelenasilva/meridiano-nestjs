import { FeedProfile } from '../../shared/types/feed';

export const FEED_DEFAULT_ITEM_LIMIT = 20;
export const FEED_MAX_ITEM_LIMIT = 100;

const VALID_FEED_PROFILES = new Set<string>(Object.values(FeedProfile));

const NUMERIC_LIMIT_PATTERN = /^\d+(\.\d+)?$/;

export function parseFeedLimit(value: string | undefined): number {
  if (typeof value !== 'string') {
    return FEED_DEFAULT_ITEM_LIMIT;
  }

  const trimmed = value.trim();

  if (!NUMERIC_LIMIT_PATTERN.test(trimmed)) {
    return FEED_DEFAULT_ITEM_LIMIT;
  }

  const parsed = Math.trunc(Number(trimmed));

  if (parsed <= 0) {
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

export function parseChannelId(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}
