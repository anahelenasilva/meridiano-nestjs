import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { AudioFilesCleanupService } from '../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../notes/notes-cleanup.service';
import { FeedProfile } from '../shared/types/feed';
import { ArticleCategory } from './article.entity';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockNotesCleanupService = mock<NotesCleanupService>();
  const mockAudioFilesCleanupService = mock<AudioFilesCleanupService>();
  const mockDb = {
    all: jest.fn(),
    get: jest.fn(),
    prepare: jest.fn(),
  };
  let service: ArticlesService;

  beforeEach(() => {
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    mockNotesCleanupService.purgeNotesForSource.mockResolvedValue(0);
    mockAudioFilesCleanupService.purgeAudioForSource.mockResolvedValue();
    service = new ArticlesService(
      mockDatabaseService,
      mockNotesCleanupService,
      mockAudioFilesCleanupService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getYesterdayArticlesByProfile', () => {
    it('queries with TECHNOLOGY feed_profile, non-null impact_rating, and descending order', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getYesterdayArticlesByProfile();

      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('feed_profile = ?');
      expect(query).toContain('impact_rating IS NOT NULL');
      expect(query).toContain('published_date >= ?');
      expect(query).toContain('published_date < ?');
      expect(query).toContain('ORDER BY impact_rating DESC');
      expect(params[0]).toBe(FeedProfile.TECHNOLOGY);
    });

    it('sets a 24-hour date range ending at today midnight BRT (UTC-3)', async () => {
      const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
      const callTime = new Date();

      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getYesterdayArticlesByProfile();

      const [, params] = mockDb.all.mock.calls[0];
      const startParam = new Date(params[1] as string);
      const endParam = new Date(params[2] as string);

      // interval must be exactly 24 hours
      expect(endParam.getTime() - startParam.getTime()).toBe(24 * 60 * 60 * 1000);

      // end must be today's midnight in BRT — UTC hour must be 3 and minutes/seconds 0
      expect(endParam.getUTCHours()).toBe(3);
      expect(endParam.getUTCMinutes()).toBe(0);
      expect(endParam.getUTCSeconds()).toBe(0);

      // end date in BRT must equal today's date in BRT at the time of the call
      const nowBrt = new Date(callTime.getTime() - BRT_OFFSET_MS);
      expect(endParam.getUTCFullYear()).toBe(nowBrt.getUTCFullYear());
      expect(endParam.getUTCMonth()).toBe(nowBrt.getUTCMonth());
      // allow same day or next (edge case if test runs near midnight BRT)
      expect([nowBrt.getUTCDate(), nowBrt.getUTCDate() + 1]).toContain(
        endParam.getUTCDate(),
      );
    });

    it('maps rows to DBArticle with parsed dates and categories', async () => {
      const row = {
        id: 'aaaa-1111',
        url: 'https://example.com/tech',
        title: 'Tech news',
        published_date: '2026-05-15T10:00:00.000Z',
        feed_source: 'TechFeed',
        raw_content: 'content',
        processed_content: 'processed',
        impact_rating: 7,
        feed_profile: FeedProfile.TECHNOLOGY,
        image_url: null,
        categories: '["tech","ai"]',
        custom_prompt: null,
        created_at: '2026-05-15T11:00:00.000Z',
      };
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [row]);
      });

      const result = await service.getYesterdayArticlesByProfile();

      expect(result).toEqual([
        expect.objectContaining({
          id: 'aaaa-1111',
          title: 'Tech news',
          impact_rating: 7,
          published_date: new Date('2026-05-15T10:00:00.000Z'),
          created_at: new Date('2026-05-15T11:00:00.000Z'),
          categories: ['tech', 'ai'],
        }),
      ]);
    });

    it('returns empty array when no articles match', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await expect(service.getYesterdayArticlesByProfile()).resolves.toEqual([]);
    });

    it('rejects when the database query fails', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db error'));
      });

      await expect(service.getYesterdayArticlesByProfile()).rejects.toThrow(
        'db error',
      );
    });
  });

  describe('getArticleByUrl', () => {
    it('returns the matching article when found', async () => {
      const row = {
        id: 'bbbb-2222',
        url: 'https://example.com/found',
        title: 'Found article',
        published_date: '2026-05-10T08:00:00.000Z',
        feed_source: 'RSS Feed',
        raw_content: 'article raw content',
        processed_content: null,
        impact_rating: null,
        feed_profile: FeedProfile.TECHNOLOGY,
        image_url: null,
        categories: '["news"]',
        custom_prompt: null,
        created_at: '2026-05-10T08:01:00.000Z',
      };
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, row);
      });

      const result = await service.getArticleByUrl('https://example.com/found');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'bbbb-2222',
          url: 'https://example.com/found',
          raw_content: 'article raw content',
          published_date: new Date('2026-05-10T08:00:00.000Z'),
          created_at: new Date('2026-05-10T08:01:00.000Z'),
          categories: ['news'],
        }),
      );
    });

    it('returns null when no article matches the URL', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, undefined);
      });

      const result = await service.getArticleByUrl('https://example.com/missing');

      expect(result).toBeNull();
    });

    it('rejects when the database query fails', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db error'));
      });

      await expect(service.getArticleByUrl('https://example.com/error')).rejects.toThrow('db error');
    });
  });

  describe('getArticlesByIds', () => {
    it('returns an empty array without querying when ids are empty', async () => {
      await expect(service.getArticlesByIds([])).resolves.toEqual([]);

      expect(mockDb.all).not.toHaveBeenCalled();
    });

    it('queries articles with a bound uuid array and maps row fields', async () => {
      const ids = [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      ];
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [
          {
            id: ids[0],
            url: 'https://example.com/one',
            title: 'First article',
            published_date: '2026-04-25T12:00:00.000Z',
            feed_source: 'Feed',
            content: 'Raw content',
            processed_content: 'Processed content',
            impact_rating: 8,
            feed_profile: FeedProfile.DEFAULT,
            image_url: null,
            categories: '["news","research"]',
            custom_prompt: null,
            created_at: '2026-04-25T12:30:00.000Z',
          },
        ]);
      });

      const result = await service.getArticlesByIds(ids);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ANY(?::uuid[])'),
        [ids, ids],
        expect.any(Function),
      );
      expect(mockDb.all.mock.calls[0][0]).toContain(
        'ORDER BY array_position(?::uuid[], id)',
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: ids[0],
          title: 'First article',
          published_date: new Date('2026-04-25T12:00:00.000Z'),
          created_at: new Date('2026-04-25T12:30:00.000Z'),
          categories: ['news', 'research'],
        }),
      ]);
    });

    it('rejects when the database query fails', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('database failed'));
      });

      await expect(
        service.getArticlesByIds(['11111111-1111-1111-1111-111111111111']),
      ).rejects.toThrow('database failed');
    });
  });

  describe('deleteArticleById', () => {
    const articleId = '11111111-1111-1111-1111-111111111111';

    const stubDeleteSuccess = () => {
      const stmt = {
        run: jest.fn((params: unknown[], callback: (err: Error | null) => void) => {
          callback(null);
        }),
        finalize: jest.fn(),
      };
      mockDb.prepare.mockReturnValue(stmt);
      return stmt;
    };

    it('purges every note for the article after deleting it', async () => {
      const stmt = stubDeleteSuccess();

      await service.deleteArticleById(articleId);

      expect(stmt.run).toHaveBeenCalledWith(
        [articleId],
        expect.any(Function),
      );
      expect(
        mockNotesCleanupService.purgeNotesForSource,
      ).toHaveBeenCalledWith('article', articleId);
    });

    it('purges the article audio after deleting it', async () => {
      stubDeleteSuccess();

      await service.deleteArticleById(articleId);

      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).toHaveBeenCalledWith('article', articleId);
    });

    it('does not purge notes or audio when the article delete fails', async () => {
      const stmt = {
        run: jest.fn((params: unknown[], callback: (err: Error | null) => void) => {
          callback(new Error('delete failed'));
        }),
        finalize: jest.fn(),
      };
      mockDb.prepare.mockReturnValue(stmt);

      await expect(service.deleteArticleById(articleId)).rejects.toThrow(
        'delete failed',
      );
      expect(
        mockNotesCleanupService.purgeNotesForSource,
      ).not.toHaveBeenCalled();
      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateArticle', () => {
    const articleId = '11111111-1111-1111-1111-111111111111';

    const captureGet = () => {
      let captured: { query: string; params: unknown[] } | undefined;
      mockDb.get.mockImplementationOnce(
        (
          query: string,
          params: unknown[],
          callback: (err: Error | null, row?: unknown) => void,
        ) => {
          captured = { query, params };
          callback(null, {
            id: articleId,
            url: 'https://example.com',
            title: 'title',
            published_date: '2024-01-01T00:00:00.000Z',
            feed_source: 'source',
            feed_profile: FeedProfile.TECHNOLOGY,
            raw_content: 'raw',
            categories: '[]',
            created_at: '2024-01-01T00:00:00.000Z',
          });
        },
      );
      return () => captured!;
    };

    it('builds a SET clause over only the provided keys', async () => {
      const get = captureGet();

      await service.updateArticle(articleId, { title: 'New title' });

      const { query, params } = get();
      expect(query).toContain('title = ?');
      expect(query).not.toContain('feed_source = ?');
      expect(query).not.toContain('feed_profile = ?');
      expect(query).not.toContain('published_date = ?');
      expect(query).not.toContain('categories = ?');
      // title value first, article id last (WHERE)
      expect(params).toEqual(['New title', articleId]);
    });

    it('stores categories JSON-stringified and de-duplicated', async () => {
      const get = captureGet();

      await service.updateArticle(articleId, {
        categories: [
          ArticleCategory.NEWS,
          ArticleCategory.NEWS,
          ArticleCategory.BLOG,
        ],
      });

      const { params } = get();
      expect(params[0]).toBe(
        JSON.stringify([ArticleCategory.NEWS, ArticleCategory.BLOG]),
      );
    });

    it('persists an empty category list as the non-null string "[]"', async () => {
      const get = captureGet();

      await service.updateArticle(articleId, { categories: [] });

      const { query, params } = get();
      expect(query).toContain('categories = ?');
      expect(params[0]).toBe('[]');
    });

    it('serialises publishedDate to an ISO string', async () => {
      const get = captureGet();
      const date = new Date('2023-05-01T10:00:00.000Z');

      await service.updateArticle(articleId, { publishedDate: date });

      const { params } = get();
      expect(params[0]).toBe(date.toISOString());
    });

    it('short-circuits to a plain fetch when the patch has no keys', async () => {
      const getById = jest
        .spyOn(service, 'getArticleById')
        .mockResolvedValue(null);

      await service.updateArticle(articleId, {});

      expect(getById).toHaveBeenCalledWith(articleId);
      expect(mockDb.get).not.toHaveBeenCalled();
      getById.mockRestore();
    });

    it('resolves null when no row is returned', async () => {
      mockDb.get.mockImplementationOnce(
        (
          _query: string,
          _params: unknown[],
          callback: (err: Error | null, row?: unknown) => void,
        ) => {
          callback(null, undefined);
        },
      );

      await expect(
        service.updateArticle(articleId, { title: 'x' }),
      ).resolves.toBeNull();
    });
  });

  describe('archive scoping on list reads', () => {
    it('defaults getArticlesPaginated to active rows only', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getArticlesPaginated({});

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
      expect(query).not.toContain('archived_at IS NOT NULL');
    });

    it('returns only archived rows for getArticlesPaginated with scope archived', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getArticlesPaginated({ archiveScope: 'archived' });

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NOT NULL');
    });

    it('applies no archive filter for getArticlesPaginated with scope all', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getArticlesPaginated({ archiveScope: 'all' });

      const [query] = mockDb.all.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
    });

    it('defaults countTotalArticles to active rows only', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 0 });
      });

      await service.countTotalArticles({});

      const [query] = mockDb.get.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
    });

    it('counts only archived rows for countTotalArticles with scope archived', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 0 });
      });

      await service.countTotalArticles({ archiveScope: 'archived' });

      const [query] = mockDb.get.mock.calls[0];
      expect(query).toContain('archived_at IS NOT NULL');
    });

    it('applies no archive filter for countTotalArticles with scope all', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 0 });
      });

      await service.countTotalArticles({ archiveScope: 'all' });

      const [query] = mockDb.get.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
    });

    it('maps archived_at to a Date and a missing value to null', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [
          {
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
            has_audio: false,
          },
          {
            id: 'a-2',
            url: 'https://example.com/2',
            title: 'Two',
            published_date: '2026-05-15T10:00:00.000Z',
            feed_source: 'Feed',
            raw_content: 'raw',
            feed_profile: 'technology',
            created_at: '2026-05-15T10:00:00.000Z',
            categories: null,
            archived_at: null,
            has_audio: false,
          },
        ]);
      });

      const articles = await service.getArticlesPaginated({
        archiveScope: 'all',
      });

      expect(articles[0].archived_at).toEqual(
        new Date('2026-06-01T09:00:00.000Z'),
      );
      expect(articles[1].archived_at).toBeNull();
    });
  });

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
      expect(article?.archived_at).toEqual(new Date('2026-06-01T09:00:00.000Z'));
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
      expect(article?.archived_at).toEqual(new Date('2026-06-01T09:00:00.000Z'));
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
      expect(article?.archived_at).toEqual(new Date('2026-06-01T09:00:00.000Z'));
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
