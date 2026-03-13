import { prepareArticleContent } from '../../articles/helpers/prepareArticleContent';
import { buildFinalPrompt } from './build-final-prompt';

describe('Custom Prompt Backward Compatibility', () => {
  describe('buildFinalPrompt - null/empty variants produce identical base prompt', () => {
    const basePrompt = 'Summarize this content.';

    it('returns base prompt when custom prompt is undefined', () => {
      expect(buildFinalPrompt(basePrompt, undefined)).toBe(basePrompt);
    });

    it('returns base prompt when custom prompt is null', () => {
      expect(buildFinalPrompt(basePrompt, null)).toBe(basePrompt);
    });

    it('returns base prompt when custom prompt is empty string', () => {
      expect(buildFinalPrompt(basePrompt, '')).toBe(basePrompt);
    });

    it('returns base prompt when custom prompt is whitespace only', () => {
      expect(buildFinalPrompt(basePrompt, '   ')).toBe(basePrompt);
    });

    it('returns base prompt when custom prompt is tab-only', () => {
      expect(buildFinalPrompt(basePrompt, '\t')).toBe(basePrompt);
    });

    it('does NOT append delimiter when custom prompt is null', () => {
      const result = buildFinalPrompt(basePrompt, null);
      expect(result).not.toContain('Additional instructions:');
      expect(result).toBe(basePrompt);
    });
  });

  describe('buildFinalPrompt - custom prompt present appends correctly', () => {
    it('appends custom prompt with delimiter when present', () => {
      const base = 'Summarize this article.';
      const custom = 'Focus on technical details.';
      expect(buildFinalPrompt(base, custom)).toBe(
        'Summarize this article.\n\nAdditional instructions: Focus on technical details.',
      );
    });
  });

  describe('prepareArticleContent - API response includes custom_prompt', () => {
    it('includes custom_prompt null in article response for existing records', async () => {
      const article = {
        id: 'article-1',
        url: 'https://example.com',
        title: 'Test',
        published_date: new Date(),
        feed_source: 'test',
        raw_content: 'Content',
        feed_profile: 'default',
        created_at: new Date(),
        custom_prompt: null as string | null,
      };

      const result = await prepareArticleContent(article as never);

      expect(result).toHaveProperty('custom_prompt', null);
    });

    it('includes custom_prompt value when set', async () => {
      const article = {
        id: 'article-1',
        url: 'https://example.com',
        title: 'Test',
        published_date: new Date(),
        feed_source: 'test',
        raw_content: 'Content',
        feed_profile: 'default',
        created_at: new Date(),
        custom_prompt: 'Focus on security.',
      };

      const result = await prepareArticleContent(article as never);

      expect(result).toHaveProperty('custom_prompt', 'Focus on security.');
    });
  });
});
