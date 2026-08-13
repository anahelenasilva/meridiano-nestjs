import { NEWS_DIGEST_JOB, NEWS_DIGEST_QUEUE } from '@libs/queue/constants/queue.constants';
import { RedisService } from '@libs/redis';
import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestsService } from './digests.service';
import { NewsDigestService } from './news-digest.service';

jest.mock('bullmq');

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
  } as DBArticle;
}

describe('NewsDigestService', () => {
  let service: NewsDigestService;
  let mockRedisService: ReturnType<typeof mock<RedisService>>;
  let mockArticlesService: ReturnType<typeof mock<ArticlesService>>;
  let mockSelectorService: ReturnType<typeof mock<DigestArticleSelectorService>>;
  let mockDigestsService: ReturnType<typeof mock<DigestsService>>;
  let mockQueue: ReturnType<typeof mock<Queue>>;
  let mockWorker: ReturnType<typeof mock<Worker>>;
  const redisClient = {};

  beforeEach(() => {
    mockRedisService = mock<RedisService>();
    mockArticlesService = mock<ArticlesService>();
    mockSelectorService = mock<DigestArticleSelectorService>();
    mockDigestsService = mock<DigestsService>();
    mockQueue = mock<Queue>();
    mockWorker = mock<Worker>();

    (Queue as unknown as jest.Mock).mockImplementation(() => mockQueue);
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);

    mockRedisService.getClient.mockReturnValue(redisClient as never);

    service = new NewsDigestService(
      mockRedisService,
      mockArticlesService,
      mockSelectorService,
      mockDigestsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('creates queue and worker with the redis connection', () => {
      service.onModuleInit();

      expect(Queue).toHaveBeenCalledWith(NEWS_DIGEST_QUEUE, { connection: redisClient });
      expect(Worker).toHaveBeenCalledWith(
        NEWS_DIGEST_QUEUE,
        expect.any(Function),
        { connection: redisClient },
      );
    });

    it('seeds a daily repeatable job at 10:00 UTC with retry config', async () => {
      service.onModuleInit();

      await Promise.resolve();

      expect(mockQueue.add).toHaveBeenCalledWith(
        NEWS_DIGEST_JOB,
        {},
        {
          repeat: { pattern: '0 10 * * *' },
          attempts: 2,
          backoff: { type: 'fixed', delay: 600_000 },
        },
      );
    });

    it('logs error when seed fails', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mockQueue.add.mockRejectedValueOnce(new Error('Redis unavailable'));

      service.onModuleInit();
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to seed news digest repeatable job',
        expect.anything(),
      );
    });

    it('logs error when retries are exhausted', () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      service.onModuleInit();

      const failedHandler = mockWorker.on.mock.calls.find(
        ([event]) => event === 'failed',
      )?.[1] as (job: Job | undefined, err: Error) => void;

      failedHandler(
        { id: 'job-1', attemptsMade: 2, opts: { attempts: 2 } } as Job,
        new Error('AI failed'),
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'News digest job job-1 failed after 2/2 attempts',
        expect.anything(),
      );
    });

    it('logs warning for retryable failures', () => {
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      service.onModuleInit();

      const failedHandler = mockWorker.on.mock.calls.find(
        ([event]) => event === 'failed',
      )?.[1] as (job: Job | undefined, err: Error) => void;

      failedHandler(
        { id: 'job-1', attemptsMade: 1, opts: { attempts: 2 } } as Job,
        new Error('AI failed'),
      );

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'News digest job job-1 failed attempt 1/2; retry scheduled: AI failed',
      );
    });
  });

  describe('buildDigest', () => {
    it('maps articles to Digest Items', () => {
      const articles = [
        makeArticle({
          id: 'a1',
          title: 'Title 1',
          feed_source: 'Source 1',
          url: 'https://example.com/1',
        }),
      ];

      expect(service.buildDigest(articles)).toEqual([
        {
          articleId: 'a1',
          title: 'Title 1',
          feedSource: 'Source 1',
          url: 'https://example.com/1',
        },
      ]);
    });

    it('coerces missing fields to empty string', () => {
      const articles = [
        makeArticle({
          id: undefined as unknown as string,
          title: undefined as unknown as string,
          feed_source: undefined as unknown as string,
          url: undefined as unknown as string,
        }),
      ];

      expect(service.buildDigest(articles)).toEqual([
        { articleId: '', title: '', feedSource: '', url: '' },
      ]);
    });

    it('returns an empty array for no articles', () => {
      expect(service.buildDigest([])).toEqual([]);
    });
  });

  describe('runDigest', () => {
    it('fetches articles, selects top 10, and persists the digest without sending any email', async () => {
      const articles = [makeArticle({ id: 'a1' }), makeArticle({ id: 'a2' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockResolvedValue(articles);
      mockDigestsService.saveDigest.mockResolvedValue('digest-1');

      await service.runDigest();

      expect(mockArticlesService.getYesterdayArticlesByProfile).toHaveBeenCalled();
      expect(mockSelectorService.selectTopArticles).toHaveBeenCalledWith(articles);
      expect(mockDigestsService.saveDigest).toHaveBeenCalledWith(service.buildDigest(articles));
    });

    it('skips persistence when no articles are selected', async () => {
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue([makeArticle()]);
      mockSelectorService.selectTopArticles.mockResolvedValue([]);

      await service.runDigest();

      expect(mockDigestsService.saveDigest).not.toHaveBeenCalled();
    });

    it('throws when saveDigest fails, allowing BullMQ to retry', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockResolvedValue(articles);
      mockDigestsService.saveDigest.mockRejectedValue(new Error('DB error'));

      await expect(service.runDigest()).rejects.toThrow('DB error');
    });

    it('throws when selectTopArticles fails, allowing BullMQ to retry', async () => {
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue([makeArticle()]);
      mockSelectorService.selectTopArticles.mockRejectedValue(new Error('AI service error'));

      await expect(service.runDigest()).rejects.toThrow('AI service error');
      expect(mockDigestsService.saveDigest).not.toHaveBeenCalled();
    });

    it('succeeds on second call after AI failure, simulating BullMQ retry', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValueOnce(articles);
      mockDigestsService.saveDigest.mockResolvedValue('digest-1');

      await expect(service.runDigest()).rejects.toThrow('AI service error');
      await expect(service.runDigest()).resolves.toBeUndefined();

      expect(mockDigestsService.saveDigest).toHaveBeenCalledTimes(1);
    });

    it('propagates failure after exhausted retries (total failure scenario)', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockRejectedValue(new Error('AI permanently down'));

      await expect(service.runDigest()).rejects.toThrow('AI permanently down');
      await expect(service.runDigest()).rejects.toThrow('AI permanently down');

      expect(mockDigestsService.saveDigest).not.toHaveBeenCalled();
    });
  });

  describe('getLatestDigest', () => {
    it('returns the latest digest items', async () => {
      const items = [
        { articleId: 'a1', title: 'Title 1', feedSource: 'Source 1', url: 'https://example.com/1' },
      ];
      mockDigestsService.findLatest.mockResolvedValue({
        id: 'digest-1',
        items,
        createdAt: new Date(),
      } as never);

      const result = await service.getLatestDigest();

      expect(mockDigestsService.findLatest).toHaveBeenCalled();
      expect(result).toBe(items);
    });

    it('returns an empty array when no digest exists', async () => {
      mockDigestsService.findLatest.mockResolvedValue(null);

      const result = await service.getLatestDigest();

      expect(result).toEqual([]);
    });
  });

  describe('onModuleDestroy', () => {
    it('closes worker and queue on destroy', async () => {
      service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
