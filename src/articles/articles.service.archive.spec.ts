import { FeedProfile } from '../shared/types/feed';
import { ArticlesService } from './articles.service';
import {
  buildArticlesService,
  createArticlesServiceMocks,
  resetArticlesServiceMocks,
} from './test-helpers';

describe('ArticlesService', () => {
  const mocks = createArticlesServiceMocks();
  const { mockDb } = mocks;
  let service: ArticlesService;

  beforeEach(() => {
    service = buildArticlesService(mocks);
  });

  afterEach(resetArticlesServiceMocks);

  describe('archive scoping on the AI selection reads', () => {
    it('excludes archived articles from the briefing candidate pool', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getArticlesForBriefing(24, FeedProfile.TECHNOLOGY);

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
    });

    it('excludes archived articles from News Digest selection', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getYesterdayArticlesByProfile();

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
    });

    it('excludes archived articles from the related list', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          feed_profile: 'technology',
          published_date: '2026-05-15T10:00:00.000Z',
        });
      });
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getRelatedArticles('a-1', 5);

      const [relatedQuery] = mockDb.all.mock.calls[0];
      expect(relatedQuery).toContain('archived_at IS NULL');
    });
  });

  describe('archive scoping on getDistinctCategories', () => {
    it('defaults to active rows only', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctCategories();

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
      expect(query).not.toContain('archived_at IS NOT NULL');
    });

    it('offers categories from archived rows when scope is archived', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctCategories('archived');

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NOT NULL');
    });

    it('applies no archive filter for scope all, with no dangling WHERE or AND', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctCategories('all');

      const [query] = mockDb.all.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
      expect(query.trim().endsWith("AND categories != ''")).toBe(true);
    });
  });

  // The highest-value tests in this feature. If an archived article stops
  // matching here, the RSS scraper treats it as new and re-ingests it on every
  // subsequent run, silently and forever.
  describe('deduplication still sees archived articles', () => {
    it('articleExists applies no archive filter', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 'a-1' });
      });

      const exists = await service.articleExists('https://example.com/1');

      const [query] = mockDb.get.mock.calls[0];
      expect(query).not.toContain('archived_at');
      expect(exists).toBe(true);
    });

    it('getArticleByUrl applies no archive filter and returns the archived row', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'a-1',
          url: 'https://example.com/1',
          title: 'One',
          published_date: '2026-05-15T10:00:00.000Z',
          feed_source: 'Feed',
          raw_content: 'raw',
          feed_profile: 'technology',
          created_at: '2026-05-15T10:00:00.000Z',
          categories: null,
          archived_at: '2026-06-01T09:00:00.000Z',
        });
      });

      const article = await service.getArticleByUrl('https://example.com/1');

      const [query] = mockDb.get.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
      expect(article?.id).toBe('a-1');
      expect(article?.archived_at).toEqual(
        new Date('2026-06-01T09:00:00.000Z'),
      );
    });

    it('getArticleById applies no archive filter so an archived article still opens', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'a-1',
          url: 'https://example.com/1',
          title: 'One',
          published_date: '2026-05-15T10:00:00.000Z',
          feed_source: 'Feed',
          raw_content: 'raw',
          feed_profile: 'technology',
          created_at: '2026-05-15T10:00:00.000Z',
          categories: null,
          archived_at: '2026-06-01T09:00:00.000Z',
        });
      });

      const article = await service.getArticleById('a-1');

      const [query] = mockDb.get.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
      expect(article?.archived_at).toEqual(
        new Date('2026-06-01T09:00:00.000Z'),
      );
    });

    it('the processing pipeline still sees archived articles', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await service.getUnprocessedArticles(FeedProfile.TECHNOLOGY);
      await service.getUnratedArticles(FeedProfile.TECHNOLOGY);
      await service.getUncategorizedArticles(FeedProfile.TECHNOLOGY);

      for (const [query] of mockDb.all.mock.calls) {
        expect(query).not.toContain('archived_at IS');
      }
    });

    it('getArticlesByIds applies no archive filter, since the user chose the ids', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getArticlesByIds(['a-1']);

      const [query] = mockDb.all.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
    });
  });

  describe('archiveArticle', () => {
    const ARCHIVED_ROW = {
      id: 'a-1',
      url: 'https://example.com/1',
      title: 'One',
      published_date: '2026-05-15T10:00:00.000Z',
      feed_source: 'Feed',
      raw_content: 'raw',
      feed_profile: 'technology',
      created_at: '2026-05-15T10:00:00.000Z',
      categories: null,
      archived_at: '2026-06-01T09:00:00.000Z',
    };

    it('sets archived_at and returns the updated article', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, ARCHIVED_ROW);
      });

      const article = await service.archiveArticle('a-1');

      const [query, params] = mockDb.get.mock.calls[0];
      expect(query).toContain('UPDATE articles');
      expect(query).toContain('SET archived_at =');
      expect(params).toEqual(['a-1']);
      expect(article?.archived_at).toEqual(
        new Date('2026-06-01T09:00:00.000Z'),
      );
    });

    it('uses COALESCE so a repeat archive does not re-stamp', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, ARCHIVED_ROW);
      });

      await service.archiveArticle('a-1');

      // COALESCE is what makes a second POST idempotent rather than a re-stamp.
      const [query] = mockDb.get.mock.calls[0];
      expect(query).toContain('COALESCE(archived_at');
    });

    it('returns null for an unknown article id', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.archiveArticle('missing')).resolves.toBeNull();
    });
  });

  describe('unarchiveArticle', () => {
    it('clears archived_at and returns the updated article', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'a-1',
          url: 'https://example.com/1',
          title: 'One',
          published_date: '2026-05-15T10:00:00.000Z',
          feed_source: 'Feed',
          raw_content: 'raw',
          feed_profile: 'technology',
          created_at: '2026-05-15T10:00:00.000Z',
          categories: null,
          archived_at: null,
        });
      });

      const article = await service.unarchiveArticle('a-1');

      const [query, params] = mockDb.get.mock.calls[0];
      expect(query).toContain('SET archived_at = NULL');
      expect(params).toEqual(['a-1']);
      expect(article?.archived_at).toBeNull();
    });

    it('returns null for an unknown article id', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.unarchiveArticle('missing')).resolves.toBeNull();
    });
  });
});
