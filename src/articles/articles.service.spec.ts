import { Logger } from '@nestjs/common';
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

    it('spans the Meridiano Day before the current one', async () => {
      // 22:00 on 2026-10-25 in Sao Paulo, already 2026-10-26 in UTC: the
      // instant where the digest and preset=yesterday used to disagree (#333).
      jest.useFakeTimers().setSystemTime(new Date('2026-10-26T01:00:00Z'));
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getYesterdayArticlesByProfile();

      const [, params] = mockDb.all.mock.calls[0];
      expect(params).toEqual([
        FeedProfile.TECHNOLOGY,
        '2026-10-24T03:00:00.000Z',
        '2026-10-25T03:00:00.000Z',
      ]);
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

      await expect(service.getYesterdayArticlesByProfile()).resolves.toEqual(
        [],
      );
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

      const result = await service.getArticleByUrl(
        'https://example.com/missing',
      );

      expect(result).toBeNull();
    });

    it('rejects when the database query fails', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db error'));
      });

      await expect(
        service.getArticleByUrl('https://example.com/error'),
      ).rejects.toThrow('db error');
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
        expect.stringContaining('AND id = ANY(?::uuid[])'),
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

  describe('listArticles', () => {
    it('maps archived_at to a Date, a missing value to null, and the count to a number', async () => {
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
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { count: '2' });
      });

      const { articles, total } = await service.listArticles({
        archiveScope: 'all',
      });

      expect(total).toBe(2);
      expect(articles[0].archived_at).toEqual(
        new Date('2026-06-01T09:00:00.000Z'),
      );
      expect(articles[1].archived_at).toBeNull();
    });
  });

  describe('getArticlesForBriefing', () => {
    const row = (id: string, embedding: number[]) => ({
      id,
      url: `https://example.com/${id}`,
      title: id,
      published_date: '2026-05-15T10:00:00.000Z',
      feed_source: 'Feed',
      raw_content: 'raw',
      processed_content: 'summary',
      embedding: JSON.stringify(embedding),
      feed_profile: 'technology',
      created_at: '2026-05-15T10:00:00.000Z',
      archived_at: null,
    });

    it('returns parsed vectors and drops articles off the majority dimension', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [
          row('old', [1, 2, 3]),
          row('a1', [0.1, 0.2]),
          row('a2', [0.3, 0.4]),
        ]);
      });

      const pool = await service.getArticlesForBriefing(
        24,
        FeedProfile.TECHNOLOGY,
      );

      expect(pool.map((a) => [a.id, a.embedding])).toEqual([
        ['a1', [0.1, 0.2]],
        ['a2', [0.3, 0.4]],
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mixed embedding dimensions'),
      );
    });
  });

  describe('getDistinctFeedSources', () => {
    it('returns each row feed_source in database order', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, [
          { feed_source: 'Fabio Akita' },
          { feed_source: 'Will Larson' },
        ]);
      });

      const sources = await service.getDistinctFeedSources();

      expect(sources).toEqual(['Fabio Akita', 'Will Larson']);
      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('SELECT DISTINCT feed_source');
      expect(query).toContain('ORDER BY feed_source');
    });

    it('defaults to active rows only', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctFeedSources();

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NULL');
      expect(query).not.toContain('archived_at IS NOT NULL');
    });

    it('offers sources from archived rows when scope is archived', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctFeedSources('archived');

      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain('archived_at IS NOT NULL');
    });

    it('applies no archive filter for scope all', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getDistinctFeedSources('all');

      const [query] = mockDb.all.mock.calls[0];
      expect(query).not.toContain('archived_at IS');
    });

    it('rejects when the database query fails', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('boom'), []);
      });

      await expect(service.getDistinctFeedSources()).rejects.toThrow('boom');
    });
  });
});
