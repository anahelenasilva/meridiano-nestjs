import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { DBArticle } from '../articles/article.entity';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestEmailComposerService } from './digest-email-composer.service';
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
  let mockComposerService: ReturnType<typeof mock<DigestEmailComposerService>>;
  let mockEmailService: ReturnType<typeof mock<EmailService>>;
  let mockConfigService: ReturnType<typeof mock<ConfigService>>;
  let mockQueue: ReturnType<typeof mock<Queue>>;
  let mockWorker: ReturnType<typeof mock<Worker>>;
  const redisClient = {};

  beforeEach(() => {
    mockRedisService = mock<RedisService>();
    mockArticlesService = mock<ArticlesService>();
    mockSelectorService = mock<DigestArticleSelectorService>();
    mockComposerService = mock<DigestEmailComposerService>();
    mockEmailService = mock<EmailService>();
    mockConfigService = mock<ConfigService>();
    mockQueue = mock<Queue>();
    mockWorker = mock<Worker>();

    (Queue as unknown as jest.Mock).mockImplementation(() => mockQueue);
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);

    mockRedisService.getClient.mockReturnValue(redisClient as never);
    mockConfigService.getNewsDigestFromEmail.mockReturnValue('digest@example.com');
    mockConfigService.getNewsDigestToEmail.mockReturnValue('user@example.com');

    service = new NewsDigestService(
      mockRedisService,
      mockArticlesService,
      mockSelectorService,
      mockComposerService,
      mockEmailService,
      mockConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('creates queue and worker with the redis connection', () => {
      service.onModuleInit();

      expect(Queue).toHaveBeenCalledWith('news-digest', { connection: redisClient });
      expect(Worker).toHaveBeenCalledWith(
        'news-digest',
        expect.any(Function),
        { connection: redisClient },
      );
    });

    it('seeds a daily repeatable job at 10:00 UTC with retry config', async () => {
      service.onModuleInit();

      await Promise.resolve();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'news-digest-job',
        {},
        {
          repeat: { pattern: '0 10 * * *' },
          attempts: 2,
          backoff: { type: 'fixed', delay: 600_000 },
        },
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

  describe('runDigest', () => {
    it('fetches articles, selects top 10, composes body, and sends email', async () => {
      const articles = [makeArticle({ id: 'a1' }), makeArticle({ id: 'a2' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockResolvedValue(articles);
      mockComposerService.compose.mockReturnValue('Digest body');
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await service.runDigest();

      expect(mockArticlesService.getYesterdayArticlesByProfile).toHaveBeenCalled();
      expect(mockSelectorService.selectTopArticles).toHaveBeenCalledWith(articles);
      expect(mockComposerService.compose).toHaveBeenCalledWith(articles);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        from: 'digest@example.com',
        to: 'user@example.com',
        subject: 'Daily News Digest',
        text: 'Digest body',
      });
    });

    it('skips email when no articles are selected', async () => {
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue([makeArticle()]);
      mockSelectorService.selectTopArticles.mockResolvedValue([]);

      await service.runDigest();

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockComposerService.compose).not.toHaveBeenCalled();
    });

    it('throws when selectTopArticles fails, allowing BullMQ to retry', async () => {
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue([makeArticle()]);
      mockSelectorService.selectTopArticles.mockRejectedValue(new Error('AI service error'));

      await expect(service.runDigest()).rejects.toThrow('AI service error');
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('succeeds on second call after AI failure, simulating BullMQ retry', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValueOnce(articles);
      mockComposerService.compose.mockReturnValue('Digest body');
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await expect(service.runDigest()).rejects.toThrow('AI service error');
      await expect(service.runDigest()).resolves.toBeUndefined();

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('throws when sendEmail fails, allowing BullMQ to retry', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockResolvedValue(articles);
      mockComposerService.compose.mockReturnValue('Digest body');
      mockEmailService.sendEmail.mockRejectedValue(new Error('Mailgun error'));

      await expect(service.runDigest()).rejects.toThrow('Mailgun error');
    });

    it('propagates failure after exhausted retries (total failure scenario)', async () => {
      const articles = [makeArticle({ id: 'a1' })];
      mockArticlesService.getYesterdayArticlesByProfile.mockResolvedValue(articles);
      mockSelectorService.selectTopArticles.mockRejectedValue(new Error('AI permanently down'));

      await expect(service.runDigest()).rejects.toThrow('AI permanently down');
      await expect(service.runDigest()).rejects.toThrow('AI permanently down');

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
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
