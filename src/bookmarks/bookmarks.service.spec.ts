import { DatabaseService, RunCallback } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { BookmarksService } from './bookmarks.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ARTICLE_ID = '22222222-2222-2222-2222-222222222222';

describe('BookmarksService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  };

  let service: BookmarksService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new BookmarksService(mockDatabaseService);
  });

  describe('addBookmark', () => {
    it('reports wasCreated: true for a fresh insert', async () => {
      mockDb.run.mockImplementationOnce((query, params, callback: RunCallback) => {
        callback.call({ changes: 1 }, null);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'bookmark-1',
          user_id: USER_ID,
          article_id: ARTICLE_ID,
          created_at: '2026-05-17T12:00:00.000Z',
        });
      });

      const result = await service.addBookmark(USER_ID, ARTICLE_ID);

      expect(result).toEqual({
        bookmark: {
          id: 'bookmark-1',
          user_id: USER_ID,
          article_id: ARTICLE_ID,
          created_at: new Date('2026-05-17T12:00:00.000Z'),
        },
        wasCreated: true,
      });
    });

    it('reports wasCreated: false and returns the existing row on a unique-violation', async () => {
      mockDb.run.mockImplementationOnce((query, params, callback) => {
        const err = new Error('duplicate key value violates unique constraint') as Error & {
          code?: string;
        };
        err.code = '23505';
        callback(err);
      });
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'existing-bookmark',
          user_id: USER_ID,
          article_id: ARTICLE_ID,
          created_at: '2026-01-01T00:00:00.000Z',
        });
      });

      const result = await service.addBookmark(USER_ID, ARTICLE_ID);

      expect(result).toEqual({
        bookmark: {
          id: 'existing-bookmark',
          user_id: USER_ID,
          article_id: ARTICLE_ID,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        wasCreated: false,
      });
    });

    it('rejects with the underlying error for non-duplicate failures', async () => {
      mockDb.run.mockImplementationOnce((query, params, callback) => {
        callback(new Error('connection reset'));
      });

      await expect(service.addBookmark(USER_ID, ARTICLE_ID)).rejects.toThrow(
        'connection reset',
      );
    });
  });

  describe('archive exclusion', () => {
    it('excludes archived articles from both the count and the rows of getBookmarks', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 0 });
      });
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getBookmarks(USER_ID, 1, 20);

      const [countQuery] = mockDb.get.mock.calls[0];
      const [rowsQuery] = mockDb.all.mock.calls[0];

      expect(countQuery).toContain('a.archived_at IS NULL');
      expect(rowsQuery).toContain('a.archived_at IS NULL');
    });

    it('excludes archived articles from getBookmarkCount, which feeds the same page total', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 0 });
      });

      await service.getBookmarkCount(USER_ID);

      const [query] = mockDb.get.mock.calls[0];
      expect(query).toContain('a.archived_at IS NULL');
    });
  });

  describe('getBookmarks', () => {
    it('maps the joined article like the articles list does', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: 1 });
      });
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [
          {
            bookmark_id: 'bookmark-1',
            bookmark_user_id: USER_ID,
            bookmark_created_at: '2026-05-17T12:00:00.000Z',
            id: ARTICLE_ID,
            url: 'https://example.com/a',
            title: 'A',
            published_date: '2026-05-01T00:00:00.000Z',
            feed_source: 'example',
            feed_profile: 'default',
            raw_content: 'raw',
            processed_content: null,
            impact_rating: 7,
            image_url: null,
            categories: null,
            custom_prompt: 'focus on X',
            created_at: '2026-05-02T00:00:00.000Z',
            archived_at: null,
          },
        ]);
      });

      const result = await service.getBookmarks(USER_ID, 1, 20);

      expect(result.bookmarks).toEqual([
        {
          id: 'bookmark-1',
          user_id: USER_ID,
          article_id: ARTICLE_ID,
          created_at: new Date('2026-05-17T12:00:00.000Z'),
          article: {
            id: ARTICLE_ID,
            url: 'https://example.com/a',
            title: 'A',
            published_date: new Date('2026-05-01T00:00:00.000Z'),
            feed_source: 'example',
            feed_profile: 'default',
            raw_content: 'raw',
            processed_content: null,
            impact_rating: 7,
            image_url: null,
            categories: undefined,
            custom_prompt: 'focus on X',
            created_at: new Date('2026-05-02T00:00:00.000Z'),
            archived_at: null,
          },
        },
      ]);
    });
  });

  describe('removeBookmark', () => {
    it('returns true when a bookmark was deleted', async () => {
      mockDb.run.mockImplementationOnce((query, params, callback: RunCallback) => {
        callback.call({ changes: 1 }, null);
      });

      await expect(service.removeBookmark(USER_ID, ARTICLE_ID)).resolves.toBe(true);
    });

    it('returns false when there was nothing to delete', async () => {
      mockDb.run.mockImplementationOnce((query, params, callback: RunCallback) => {
        callback.call({ changes: 0 }, null);
      });

      await expect(service.removeBookmark(USER_ID, ARTICLE_ID)).resolves.toBe(false);
    });
  });
});
