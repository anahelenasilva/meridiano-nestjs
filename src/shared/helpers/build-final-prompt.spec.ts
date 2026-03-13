import { buildFinalPrompt } from './build-final-prompt';

describe('buildFinalPrompt', () => {
  it('returns base prompt when custom prompt is undefined', () => {
    const base = 'Summarize this article.';
    expect(buildFinalPrompt(base, undefined)).toBe(base);
  });

  it('returns base prompt when custom prompt is null', () => {
    const base = 'Summarize this article.';
    expect(buildFinalPrompt(base, null)).toBe(base);
  });

  it('returns base prompt when custom prompt is empty string', () => {
    const base = 'Summarize this article.';
    expect(buildFinalPrompt(base, '')).toBe(base);
  });

  it('returns base prompt when custom prompt is whitespace only', () => {
    const base = 'Summarize this article.';
    expect(buildFinalPrompt(base, '   ')).toBe(base);
  });

  it('appends custom prompt with delimiter when present', () => {
    const base = 'Summarize this article.';
    const custom = 'Focus on technical details.';
    expect(buildFinalPrompt(base, custom)).toBe(
      'Summarize this article.\n\nAdditional instructions: Focus on technical details.',
    );
  });
});
