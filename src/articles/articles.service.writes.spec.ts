import { RunCallback } from '@libs/database';
import { FeedProfile } from '../shared/types/feed';
import { ArticleCategory } from './article.entity';
import { ArticlesService } from './articles.service';
import {
  buildArticlesService,
  createArticlesServiceMocks,
  resetArticlesServiceMocks,
} from './test-helpers';

describe('ArticlesService', () => {
  const mocks = createArticlesServiceMocks();
  const { mockDb, mockNotesCleanupService, mockAudioFilesCleanupService } =
    mocks;
  let service: ArticlesService;

  beforeEach(() => {
    service = buildArticlesService(mocks);
  });

  afterEach(resetArticlesServiceMocks);

  describe('deleteArticleById', () => {
    const articleId = '11111111-1111-1111-1111-111111111111';

    const stubDeleteSuccess = () => {
      mockDb.run.mockImplementationOnce(
        (sql, params, callback: RunCallback) => {
          callback.call({ changes: 1 }, null);
        },
      );
    };

    it('purges every note for the article after deleting it', async () => {
      stubDeleteSuccess();

      await service.deleteArticleById(articleId);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM articles WHERE id = ?',
        [articleId],
        expect.any(Function),
      );
      expect(mockNotesCleanupService.purgeNotesForSource).toHaveBeenCalledWith(
        'article',
        articleId,
      );
    });

    it('purges the article audio after deleting it', async () => {
      stubDeleteSuccess();

      await service.deleteArticleById(articleId);

      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).toHaveBeenCalledWith('article', articleId);
    });

    it('does not purge notes or audio when the article delete fails', async () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => undefined);
      mockDb.run.mockImplementationOnce(
        (sql, params, callback: RunCallback) => {
          callback.call({}, new Error('delete failed'));
        },
      );

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

  describe('addArticle', () => {
    const add = () =>
      service.addArticle(
        'https://example.com/new',
        'New',
        new Date('2026-09-01T12:00:00.000Z'),
        'Feed',
        'raw',
        FeedProfile.TECHNOLOGY,
      );

    it('returns the id of the inserted article', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, { id: 'new-id' });
      });

      await expect(add()).resolves.toBe('new-id');
      const [sql] = mockDb.get.mock.calls[0];
      expect(sql).toContain('RETURNING id');
    });

    it('returns null when the url already exists', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(
          Object.assign(
            new Error('duplicate key value violates unique constraint'),
            { code: '23505' },
          ),
        );
      });

      await expect(add()).resolves.toBeNull();
    });

    it('rejects on any other insert failure', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('connection reset'));
      });

      await expect(add()).rejects.toThrow('connection reset');
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
});
