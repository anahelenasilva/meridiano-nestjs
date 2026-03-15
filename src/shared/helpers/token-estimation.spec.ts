import {
  estimateTokenCount,
  estimateChatTokens,
  estimateEmbeddingTokens,
} from './token-estimation';

describe('estimateTokenCount', () => {
  describe('edge cases', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('returns 0 for null', () => {
      expect(estimateTokenCount(null as unknown as string)).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(estimateTokenCount(undefined as unknown as string)).toBe(0);
    });

    it('handles whitespace-only text', () => {
      expect(estimateTokenCount('   ')).toBe(2);
    });

    it('handles single character', () => {
      expect(estimateTokenCount('a')).toBe(1);
    });
  });

  describe('character-based estimation', () => {
    it('calculates tokens based on default charsPerToken (2.5)', () => {
      const text = 'abcdefghij';
      expect(estimateTokenCount(text)).toBe(4);
    });

    it('calculates tokens with custom charsPerToken', () => {
      const text = 'abcdefghij';
      expect(estimateTokenCount(text, 5)).toBe(2);
    });

    it('rounds up to nearest integer', () => {
      const text = 'abc';
      expect(estimateTokenCount(text, 2)).toBe(2);
    });
  });

  describe('word-based estimation', () => {
    it('counts words correctly', () => {
      const text = 'one two three four five';
      const result = estimateTokenCount(text, 100);
      expect(result).toBe(5);
    });

    it('handles multiple spaces between words', () => {
      const text = 'one   two    three';
      const result = estimateTokenCount(text, 100);
      expect(result).toBe(3);
    });

    it('handles leading and trailing whitespace', () => {
      const text = '  hello world  ';
      const result = estimateTokenCount(text, 100);
      expect(result).toBe(2);
    });
  });

  describe('punctuation handling', () => {
    it('counts punctuation and adds 0.5 tokens per punctuation mark', () => {
      const text = 'Hello, world!';
      const result = estimateTokenCount(text, 100);
      expect(result).toBe(3);
    });

    it('handles various punctuation marks', () => {
      const text = 'Hi. How are you? "Fine!" she said.';
      const result = estimateTokenCount(text, 100);
      const punctuationCount = (text.match(/[.,!?;:"'()[\]{}]/g) || []).length;
      const wordCount = text.trim().split(/\s+/).length;
      expect(result).toBe(wordCount + Math.ceil(punctuationCount * 0.5));
    });

    it('handles parentheses and brackets', () => {
      const text = '(test) [array]';
      const result = estimateTokenCount(text, 100);
      expect(result).toBe(2 + Math.ceil(4 * 0.5));
    });
  });

  describe('maximum estimation', () => {
    it('returns the maximum of char and word estimates', () => {
      const longChars = 'a'.repeat(100);
      const charEstimate = Math.ceil(100 / 2.5);
      const wordEstimate = 1;
      expect(estimateTokenCount(longChars)).toBe(Math.max(charEstimate, wordEstimate));
    });

    it('uses word estimate when higher than char estimate', () => {
      const manyWords = 'word '.repeat(50).trim();
      const result = estimateTokenCount(manyWords, 100);
      expect(result).toBe(50);
    });
  });
});

describe('estimateChatTokens', () => {
  it('uses charsPerToken of 4', () => {
    const text = 'abcdefgh';
    expect(estimateChatTokens(text)).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(estimateChatTokens('')).toBe(0);
  });

  it('handles typical chat message', () => {
    const text = 'Hello, how are you today?';
    const result = estimateChatTokens(text);
    expect(result).toBeGreaterThan(0);
  });
});

describe('estimateEmbeddingTokens', () => {
  it('uses charsPerToken of 2.5', () => {
    const text = 'abcdefghij';
    expect(estimateEmbeddingTokens(text)).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(estimateEmbeddingTokens('')).toBe(0);
  });

  it('handles typical embedding text', () => {
    const text = 'This is a longer piece of text for embedding.';
    const result = estimateEmbeddingTokens(text);
    expect(result).toBeGreaterThan(0);
  });
});