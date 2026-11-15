import { RunCallback } from '@libs/database';
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

  describe('getArticlesToReembed', () => {
    it('selects processed articles newest first', async () => {
      const rows = [{ id: 'a1', processed_content: 'summary' }];
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, rows);
      });

      const result = await service.getArticlesToReembed();

      expect(result).toEqual(rows);
      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('processed_content IS NOT NULL');
      expect(query).toContain('ORDER BY published_date DESC');
    });

    it('rejects when the database query fails', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db error'));
      });

      await expect(service.getArticlesToReembed()).rejects.toThrow('db error');
    });
  });

  describe('updateArticleEmbedding', () => {
    it('stores the embedding as JSON for the article', async () => {
      mockDb.run.mockImplementationOnce(
        (sql, params, callback: RunCallback) => {
          callback.call({ changes: 1 }, null);
        },
      );

      await service.updateArticleEmbedding('a1', [0.1, 0.2]);

      const [sql, params] = mockDb.run.mock.calls[0];
      expect(sql).toContain('SET embedding = ?');
      expect(params).toEqual(['[0.1,0.2]', 'a1']);
    });

    it('rejects when the update fails', async () => {
      mockDb.run.mockImplementationOnce(
        (sql, params, callback: RunCallback) => {
          callback.call({}, new Error('update failed'));
        },
      );

      await expect(service.updateArticleEmbedding('a1', [0.1])).rejects.toThrow(
        'update failed',
      );
    });
  });
});
