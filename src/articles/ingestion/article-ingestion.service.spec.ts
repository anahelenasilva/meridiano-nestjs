import { mock } from 'jest-mock-extended';
import { AiService } from '../../ai/ai.service';
import { FeedProfile } from '../../shared/types/feed';
import { DBArticle } from '../article.entity';
import { ArticlesService } from '../articles.service';
import { ArticleIngestionService, RawArticleInput } from './article-ingestion.service';

const makeArticle = (overrides: Partial<DBArticle> = {}): DBArticle => ({
  id: 'article-id-1',
  url: 'https://example.com/article',
  title: 'Test Article',
  published_date: new Date('2026-05-17T10:00:00.000Z'),
  feed_source: 'Test Feed',
  raw_content: 'article content',
  feed_profile: FeedProfile.TECHNOLOGY,
  created_at: new Date('2026-05-17T10:01:00.000Z'),
  ...overrides,
});

const makeInput = (overrides: Partial<RawArticleInput> = {}): RawArticleInput => ({
  url: 'https://example.com/article',
  title: 'Test Article',
  content: 'article content',
  publishedDate: new Date('2026-05-17T10:00:00.000Z'),
  feedProfile: FeedProfile.TECHNOLOGY,
  source: { type: 'rss', feedName: 'Test Feed' },
  ...overrides,
});

describe('ArticleIngestionService', () => {
  let service: ArticleIngestionService;
  let articlesService: ReturnType<typeof mock<ArticlesService>>;
  let aiService: ReturnType<typeof mock<AiService>>;

  beforeEach(() => {
    articlesService = mock<ArticlesService>();
    aiService = mock<AiService>();
    service = new ArticleIngestionService(articlesService, aiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('articleExists', () => {
    it('returns true when articlesService reports the url exists', async () => {
      articlesService.articleExists.mockResolvedValue(true);
      expect(await service.articleExists('https://example.com/article')).toBe(true);
    });

    it('returns false when articlesService reports the url does not exist', async () => {
      articlesService.articleExists.mockResolvedValue(false);
      expect(await service.articleExists('https://example.com/article')).toBe(false);
    });
  });

  describe('deduplication', () => {
    it('returns existing article and skips persistence when URL already exists', async () => {
      const existing = makeArticle();
      articlesService.getArticleByUrl.mockResolvedValue(existing);

      const result = await service.ingest(makeInput());

      expect(result).toBe(existing);
      expect(articlesService.addArticle).not.toHaveBeenCalled();
    });
  });

  describe('source attribution', () => {
    beforeEach(() => {
      articlesService.getArticleByUrl.mockResolvedValueOnce(null);
      articlesService.addArticle.mockResolvedValue('article-id-1');
      articlesService.getArticleById.mockResolvedValue(makeArticle());
    });

    it('uses feed name for RSS source', async () => {
      await service.ingest(makeInput({ source: { type: 'rss', feedName: 'Hacker News' } }));

      expect(articlesService.addArticle).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Date),
        'Hacker News',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });

    it('uses "Manual" for manual scrape source', async () => {
      await service.ingest(makeInput({ source: { type: 'manual' } }));

      expect(articlesService.addArticle).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Date),
        'Manual',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });

    it('uses AI-extracted source for markdown when extraction succeeds', async () => {
      aiService.callChat.mockResolvedValue('  TechCrunch  ');

      await service.ingest(makeInput({ source: { type: 'markdown' } }));

      expect(articlesService.addArticle).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Date),
        'TechCrunch',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });

    it('falls back to "Unknown" for markdown when AI returns null', async () => {
      aiService.callChat.mockResolvedValue(null);

      await service.ingest(makeInput({ source: { type: 'markdown' } }));

      expect(articlesService.addArticle).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Date),
        'Unknown',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });

    it('falls back to "Unknown" for markdown when AI returns empty string', async () => {
      aiService.callChat.mockResolvedValue('   ');

      await service.ingest(makeInput({ source: { type: 'markdown' } }));

      expect(articlesService.addArticle).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Date),
        'Unknown',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('persistence', () => {
    it('returns the newly created article after successful insertion', async () => {
      const newArticle = makeArticle({ id: 'new-article-id' });
      articlesService.getArticleByUrl.mockResolvedValue(null);
      articlesService.addArticle.mockResolvedValue('new-article-id');
      articlesService.getArticleById.mockResolvedValue(newArticle);

      const result = await service.ingest(makeInput());

      expect(result).toBe(newArticle);
      expect(articlesService.getArticleById).toHaveBeenCalledWith('new-article-id');
    });

    it('handles concurrent insert race by returning the concurrently inserted article', async () => {
      const concurrent = makeArticle();
      articlesService.getArticleByUrl
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(concurrent);
      articlesService.addArticle.mockResolvedValue(null);

      const result = await service.ingest(makeInput());

      expect(result).toBe(concurrent);
    });

    it('throws when addArticle returns null and no concurrent article is found', async () => {
      articlesService.getArticleByUrl.mockResolvedValue(null);
      articlesService.addArticle.mockResolvedValue(null);

      await expect(service.ingest(makeInput())).rejects.toThrow(
        'Failed to persist article: https://example.com/article',
      );
    });

    it('throws when article cannot be found by id after insertion', async () => {
      articlesService.getArticleByUrl.mockResolvedValue(null);
      articlesService.addArticle.mockResolvedValue('new-article-id');
      articlesService.getArticleById.mockResolvedValue(null);

      await expect(service.ingest(makeInput())).rejects.toThrow(
        'Article new-article-id not found after insertion',
      );
    });
  });
});
