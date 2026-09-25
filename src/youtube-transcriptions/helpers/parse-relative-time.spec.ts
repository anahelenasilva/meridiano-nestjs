import { parseRelativeTime } from './parse-relative-time';

const NOW = new Date(2024, 4, 31, 22, 30);

describe('parseRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([
    ['5 seconds ago', new Date(2024, 4, 31, 22, 29, 55)],
    ['30 seconds ago', new Date(2024, 4, 31, 22, 29, 30)],
    ['1 minute ago', new Date(2024, 4, 31, 22, 29)],
    ['15 minutes ago', new Date(2024, 4, 31, 22, 15)],
    ['1 hour ago', new Date(2024, 4, 31, 21, 30)],
    ['11 hours ago', new Date(2024, 4, 31, 11, 30)],
    ['1 day ago', new Date(2024, 4, 30, 22, 30)],
    ['2 days ago', new Date(2024, 4, 29, 22, 30)],
    ['1 week ago', new Date(2024, 4, 24, 22, 30)],
    ['3 weeks ago', new Date(2024, 4, 10, 22, 30)],
    ['1 month ago', new Date(2024, 3, 30, 22, 30)],
    ['6 months ago', new Date(2023, 10, 30, 22, 30)],
    ['1 year ago', new Date(2023, 4, 31, 22, 30)],
    ['2 years ago', new Date(2022, 4, 31, 22, 30)],
    ['1000 days ago', new Date(2024, 4, 31 - 1000, 22, 30)],
    ['0 hours ago', NOW],
  ])('parses "%s"', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected.toISOString());
  });

  it.each([
    ['5 HOURS AGO', new Date(2024, 4, 31, 17, 30)],
    ['3 DaYs AgO', new Date(2024, 4, 28, 22, 30)],
    ['  5   hours   ago  ', new Date(2024, 4, 31, 17, 30)],
    ['Streamed 2 days ago', new Date(2024, 4, 29, 22, 30)],
  ])('tolerates case, spacing, and prefixes in "%s"', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected.toISOString());
  });

  it.each([
    ['2024-01-15T10:30:00Z', '2024-01-15T10:30:00.000Z'],
    ['2024-01-15', new Date(2024, 0, 15).toISOString()],
    ['2024-01', new Date(2024, 0, 1).toISOString()],
    ['2024', new Date(2024, 0, 1).toISOString()],
    ['2024-01-15 10:30:00', new Date(2024, 0, 15, 10, 30).toISOString()],
    ['Mar 3, 2024', new Date(2024, 2, 3).toISOString()],
  ])('falls back to parsing "%s" as a date', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected);
  });

  it.each([
    '',
    null as unknown as string,
    undefined as unknown as string,
    'Unknown',
    'invalid time string',
    'ago 5 hours',
    'not a date',
    'hours ago',
    '2024-02-30',
    '2024-13-01',
  ])('returns "Unknown" for %p', (input) => {
    expect(parseRelativeTime(input)).toBe('Unknown');
  });
});
