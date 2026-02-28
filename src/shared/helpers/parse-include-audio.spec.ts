import { parseIncludeAudio } from './parse-include-audio';

describe('parseIncludeAudio', () => {
  it('should return true for "true"', () => {
    expect(parseIncludeAudio('true')).toBe(true);
  });

  it('should return true for "1"', () => {
    expect(parseIncludeAudio('1')).toBe(true);
  });

  it('should return true for "yes"', () => {
    expect(parseIncludeAudio('yes')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(parseIncludeAudio('TRUE')).toBe(true);
    expect(parseIncludeAudio('Yes')).toBe(true);
    expect(parseIncludeAudio('YES')).toBe(true);
  });

  it('should trim whitespace', () => {
    expect(parseIncludeAudio('  true  ')).toBe(true);
    expect(parseIncludeAudio('  yes  ')).toBe(true);
  });

  it('should return false for undefined', () => {
    expect(parseIncludeAudio(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(parseIncludeAudio('')).toBe(false);
  });

  it('should return false for other values', () => {
    expect(parseIncludeAudio('false')).toBe(false);
    expect(parseIncludeAudio('0')).toBe(false);
    expect(parseIncludeAudio('no')).toBe(false);
    expect(parseIncludeAudio('maybe')).toBe(false);
  });
});
