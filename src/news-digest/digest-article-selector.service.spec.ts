import { mock } from 'jest-mock-extended';
import { AiService } from '../ai/ai.service';
import { DBArticle } from '../articles/article.entity';
import { ConfigService } from '../config/config.service';
import { DigestArticleSelectorService } from './digest-article-selector.service';

function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'test-id',
    url: 'https://example.com',
    title: 'Test Article',
    published_date: new Date('2026-05-15'),
    feed_source: 'Test Source',
    raw_content: 'Raw content',
    feed_profile: 'technology',
    created_at: new Date(),
    ...overrides,
  };
}

describe('DigestArticleSelectorService', () => {
  let service: DigestArticleSelectorService;
  let mockAiService: ReturnType<typeof mock<AiService>>;
  let mockConfigService: ReturnType<typeof mock<ConfigService>>;

  beforeEach(() => {
    mockAiService = mock<AiService>();
    mockConfigService = mock<ConfigService>();
    mockConfigService.getNewsDigestPrompt.mockReturnValue('Focus on AI and cloud infrastructure');
    service = new DigestArticleSelectorService(mockAiService, mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('selectTopArticles', () => {
    it('returns empty array for empty input without calling AI', async () => {
      await expect(service.selectTopArticles([])).resolves.toEqual([]);
      expect(mockAiService.callChat).not.toHaveBeenCalled();
    });

    it('returns articles in AI-specified order for a valid response', async () => {
      const articles = [
        makeArticle({ id: 'id-1', title: 'Article 1' }),
        makeArticle({ id: 'id-2', title: 'Article 2' }),
        makeArticle({ id: 'id-3', title: 'Article 3' }),
      ];
      mockAiService.callChat.mockResolvedValue('["id-3", "id-1"]');

      const result = await service.selectTopArticles(articles);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('id-3');
      expect(result[1].id).toBe('id-1');
    });

    it('includes the NEWS_DIGEST_PROMPT criteria in the AI prompt', async () => {
      mockAiService.callChat.mockResolvedValue('[]');

      await service.selectTopArticles([makeArticle({ id: 'a-1' })]);

      const prompt = mockAiService.callChat.mock.calls[0][0];
      expect(prompt).toContain('Focus on AI and cloud infrastructure');
    });

    it('returns empty array when AI returns null', async () => {
      mockAiService.callChat.mockResolvedValue(null);

      await expect(service.selectTopArticles([makeArticle()])).resolves.toEqual([]);
    });

    it('returns empty array for a malformed (non-JSON) AI response', async () => {
      mockAiService.callChat.mockResolvedValue('Sorry, I cannot process this.');

      await expect(service.selectTopArticles([makeArticle()])).resolves.toEqual([]);
    });

    it('returns empty array for a JSON response that is not an array', async () => {
      mockAiService.callChat.mockResolvedValue('{"ids": ["id-1"]}');

      await expect(service.selectTopArticles([makeArticle({ id: 'id-1' })])).resolves.toEqual([]);
    });

    it('handles fewer than 10 input articles', async () => {
      const articles = [
        makeArticle({ id: 'a-1' }),
        makeArticle({ id: 'a-2' }),
      ];
      mockAiService.callChat.mockResolvedValue('["a-2", "a-1"]');

      const result = await service.selectTopArticles(articles);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a-2');
    });

    it('returns at most 10 articles even when AI returns more', async () => {
      const articles = Array.from({ length: 15 }, (_, i) =>
        makeArticle({ id: `id-${i + 1}` }),
      );
      const ids = articles.map((a) => `"${a.id}"`).join(',');
      mockAiService.callChat.mockResolvedValue(`[${ids}]`);

      const result = await service.selectTopArticles(articles);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('filters out IDs from the AI response that are not in the input', async () => {
      const articles = [makeArticle({ id: 'real-id' })];
      mockAiService.callChat.mockResolvedValue('["ghost-id", "real-id"]');

      const result = await service.selectTopArticles(articles);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('real-id');
    });
  });
});
