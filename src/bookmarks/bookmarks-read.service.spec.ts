import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { BookmarksReadService } from './bookmarks-read.service';

describe('BookmarksReadService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
  };

  const userId = 'user-1';
  const idA = '11111111-1111-1111-1111-111111111111';
  const idB = '22222222-2222-2222-2222-222222222222';
  const idC = '33333333-3333-3333-3333-333333333333';

  let service: BookmarksReadService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new BookmarksReadService(mockDatabaseService);
  });

  describe('isBookmarked', () => {
    it('returns true when a bookmark row exists', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { 1: 1 });
      });

      await expect(service.isBookmarked(userId, idA)).resolves.toBe(true);
      expect(mockDb.get.mock.calls[0][1]).toEqual([userId, idA]);
    });

    it('returns false when no bookmark row exists', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.isBookmarked(userId, idA)).resolves.toBe(false);
    });
  });

  describe('getBookmarkedArticleIds', () => {
    it('returns only the requested ids the user has bookmarked', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        // idB is absent from the result set: the user has not bookmarked it.
        callback(null, [{ article_id: idA }, { article_id: idC }]);
      });

      const result = await service.getBookmarkedArticleIds(userId, [
        idA,
        idB,
        idC,
      ]);

      expect(result.has(idA)).toBe(true);
      expect(result.has(idB)).toBe(false);
      expect(result.has(idC)).toBe(true);
      expect(result.size).toBe(2);
    });

    it('issues a single query for a page of ids', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getBookmarkedArticleIds(userId, [idA, idB, idC]);

      expect(mockDb.all).toHaveBeenCalledTimes(1);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('article_id = ANY(?::uuid[])');
      expect(params).toEqual([userId, [idA, idB, idC]]);
    });

    it('de-duplicates repeated ids before binding the query', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getBookmarkedArticleIds(userId, [idA, idA, idB]);

      expect(mockDb.all.mock.calls[0][1]).toEqual([userId, [idA, idB]]);
    });

    it('short-circuits to an empty set without querying when given no ids', async () => {
      const result = await service.getBookmarkedArticleIds(userId, []);

      expect(result.size).toBe(0);
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    it('does not filter on archive state, so archived articles keep their flag', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [{ article_id: idA }]);
      });

      const result = await service.getBookmarkedArticleIds(userId, [idA]);

      expect(mockDb.all.mock.calls[0][0]).not.toContain('archived_at');
      expect(result.has(idA)).toBe(true);
    });

    it('rejects when the database query errors', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db down'));
      });

      await expect(
        service.getBookmarkedArticleIds(userId, [idA]),
      ).rejects.toThrow('db down');
    });
  });
});
