import { FeedProfile } from '../../shared/types/feed';
import {
  FEED_DEFAULT_ITEM_LIMIT,
  FEED_MAX_ITEM_LIMIT,
  parseFeedLimit,
  parseFeedProfile,
} from './parse-feed-query';

describe('parseFeedLimit', () => {
  it('returns the default limit when the value is undefined', () => {
    expect(parseFeedLimit(undefined)).toBe(FEED_DEFAULT_ITEM_LIMIT);
  });

  it('returns the default limit when the value is empty or blank', () => {
    expect(parseFeedLimit('')).toBe(FEED_DEFAULT_ITEM_LIMIT);
    expect(parseFeedLimit('   ')).toBe(FEED_DEFAULT_ITEM_LIMIT);
  });

  it('returns the default limit when the value is not a number', () => {
    expect(parseFeedLimit('abc')).toBe(FEED_DEFAULT_ITEM_LIMIT);
  });

  it('returns the default limit when the value is zero or negative', () => {
    expect(parseFeedLimit('0')).toBe(FEED_DEFAULT_ITEM_LIMIT);
    expect(parseFeedLimit('-5')).toBe(FEED_DEFAULT_ITEM_LIMIT);
  });

  it('returns the default limit when the value is an array (repeated query key)', () => {
    expect(parseFeedLimit(['5', '10'] as unknown as string)).toBe(
      FEED_DEFAULT_ITEM_LIMIT,
    );
  });

  it('parses a valid positive integer within bounds', () => {
    expect(parseFeedLimit('5')).toBe(5);
  });

  it('caps the value at the maximum item limit', () => {
    expect(parseFeedLimit(String(FEED_MAX_ITEM_LIMIT + 500))).toBe(
      FEED_MAX_ITEM_LIMIT,
    );
  });

  it('truncates decimal values to an integer', () => {
    expect(parseFeedLimit('7.9')).toBe(7);
  });

  it('returns the default limit when the value has a numeric prefix followed by non-numeric characters', () => {
    expect(parseFeedLimit('5abc')).toBe(FEED_DEFAULT_ITEM_LIMIT);
  });
});

describe('parseFeedProfile', () => {
  it('returns undefined when the value is undefined', () => {
    expect(parseFeedProfile(undefined)).toBeUndefined();
  });

  it('returns undefined when the value is empty or blank', () => {
    expect(parseFeedProfile('')).toBeUndefined();
    expect(parseFeedProfile('   ')).toBeUndefined();
  });

  it('returns undefined for an unknown feed profile', () => {
    expect(parseFeedProfile('not-a-real-profile')).toBeUndefined();
  });

  it('returns undefined when the value is an array (repeated query key)', () => {
    expect(
      parseFeedProfile(['technology', 'business'] as unknown as string),
    ).toBeUndefined();
  });

  it('returns the matching feed profile for a known value', () => {
    expect(parseFeedProfile('technology')).toBe(FeedProfile.TECHNOLOGY);
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(parseFeedProfile('  TECHNOLOGY  ')).toBe(FeedProfile.TECHNOLOGY);
  });
});
