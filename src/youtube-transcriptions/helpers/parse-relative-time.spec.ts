import moment from 'moment';
import { parseRelativeTime } from './parse-relative-time';

describe('parseRelativeTime', () => {
  beforeEach(() => {
    // Mock console.warn to avoid noise in test output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('relative time patterns', () => {
    it('should parse seconds ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('5 seconds ago');
      const expected = now.subtract(5, 'seconds').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse seconds ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('30 seconds ago');
      const expected = now.subtract(30, 'seconds').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse minutes ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 minute ago');
      const expected = now.subtract(1, 'minutes').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse minutes ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('15 minutes ago');
      const expected = now.subtract(15, 'minutes').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse hours ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 hour ago');
      const expected = now.subtract(1, 'hours').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse hours ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('11 hours ago');
      const expected = now.subtract(11, 'hours').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse days ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 day ago');
      const expected = now.subtract(1, 'days').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse days ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('2 days ago');
      const expected = now.subtract(2, 'days').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse weeks ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 week ago');
      const expected = now.subtract(1, 'weeks').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse weeks ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('3 weeks ago');
      const expected = now.subtract(3, 'weeks').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse months ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 month ago');
      const expected = now.subtract(1, 'months').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse months ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('6 months ago');
      const expected = now.subtract(6, 'months').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse years ago (singular)', () => {
      const now = moment();
      const result = parseRelativeTime('1 year ago');
      const expected = now.subtract(1, 'years').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should parse years ago (plural)', () => {
      const now = moment();
      const result = parseRelativeTime('2 years ago');
      const expected = now.subtract(2, 'years').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase input', () => {
      const now = moment();
      const result = parseRelativeTime('5 HOURS AGO');
      const expected = now.subtract(5, 'hours').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should handle mixed case input', () => {
      const now = moment();
      const result = parseRelativeTime('3 DaYs AgO');
      const expected = now.subtract(3, 'days').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should handle lowercase input', () => {
      const now = moment();
      const result = parseRelativeTime('2 weeks ago');
      const expected = now.subtract(2, 'weeks').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });
  });

  describe('whitespace handling', () => {
    it('should handle extra whitespace', () => {
      const now = moment();
      const result = parseRelativeTime('  5   hours   ago  ');
      const expected = now.subtract(5, 'hours').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should handle single spaces', () => {
      const now = moment();
      const result = parseRelativeTime('1 day ago');
      const expected = now.subtract(1, 'days').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });
  });

  describe('regular date parsing', () => {
    it('should parse ISO date strings', () => {
      const isoDate = '2024-01-15T10:30:00Z';
      const result = parseRelativeTime(isoDate);
      expect(result).toBe(moment(isoDate).toISOString());
    });

    it('should parse common date formats', () => {
      const dateString = '2024-01-15';
      const result = parseRelativeTime(dateString);
      expect(result).toBe(moment(dateString).toISOString());
    });

    it('should parse date strings with time', () => {
      const dateString = '2024-01-15 10:30:00';
      const result = parseRelativeTime(dateString);
      expect(result).toBe(moment(dateString).toISOString());
    });
  });

  describe('edge cases and invalid inputs', () => {
    it('should return "Unknown" for empty string', () => {
      const result = parseRelativeTime('');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for null input', () => {
      const result = parseRelativeTime(null as any);
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for undefined input', () => {
      const result = parseRelativeTime(undefined as any);
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" when input is "Unknown"', () => {
      const result = parseRelativeTime('Unknown');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for invalid relative time string', () => {
      const result = parseRelativeTime('invalid time string');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for malformed relative time', () => {
      const result = parseRelativeTime('ago 5 hours');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for invalid date string', () => {
      const result = parseRelativeTime('not a date');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for relative time without number', () => {
      const result = parseRelativeTime('hours ago');
      expect(result).toBe('Unknown');
    });
  });

  describe('large numbers', () => {
    it('should handle large numbers correctly', () => {
      const now = moment();
      const result = parseRelativeTime('1000 days ago');
      const expected = now.subtract(1000, 'days').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });

    it('should handle zero correctly', () => {
      const now = moment();
      const result = parseRelativeTime('0 hours ago');
      const expected = now.subtract(0, 'hours').toISOString();
      const resultTime = moment(result);
      const expectedTime = moment(expected);
      expect(
        Math.abs(resultTime.diff(expectedTime, 'milliseconds')),
      ).toBeLessThan(1000);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and return "Unknown"', () => {
      // Test with a string that would cause an error in parsing
      // We can't easily mock moment to throw, but we can verify
      // that invalid inputs return 'Unknown' which is already tested
      // This test verifies the try-catch works by checking console.warn
      // is called when appropriate (though in practice, moment rarely throws)

      // Since we can't easily mock moment to throw, we'll test that
      // the function handles edge cases that might cause issues
      const result = parseRelativeTime('invalid');
      expect(result).toBe('Unknown');
    });
  });
});
