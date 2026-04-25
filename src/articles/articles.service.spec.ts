import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { FeedProfile } from '../shared/types/feed';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    all: jest.fn(),
  };
  let service: ArticlesService;

  beforeEach(() => {
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new ArticlesService(mockDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
});
