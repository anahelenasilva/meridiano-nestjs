import { RedisService } from '@libs/redis';
import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import { CustomBriefingProcessor } from './custom-briefing.processor';

jest.mock('bullmq');

describe('CustomBriefingProcessor', () => {
  let processor: CustomBriefingProcessor;
  const mockRedisService = mock<RedisService>();
  const mockBriefingGenerationService = mock<BriefingGenerationService>();
  const mockConfigService = mock<ConfigService>();
  const mockWorker = mock<Worker>();
  const redisClient = {};

  beforeEach(() => {
    (Worker as unknown as jest.Mock).mockImplementation(() => mockWorker);
    mockRedisService.getClient.mockReturnValue(redisClient as never);
    mockConfigService.getCustomBriefingQueueConfig.mockReturnValue({
      concurrency: 4,
      attempts: 3,
      backoffDelayMs: 5000,
    });

    processor = new CustomBriefingProcessor(
      mockRedisService,
      mockBriefingGenerationService,
      mockConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('initializes the worker with configured concurrency', () => {
      processor.onModuleInit();

      expect(Worker).toHaveBeenCalledWith(
        'custom-briefing-generation',
        expect.any(Function),
        {
          connection: redisClient,
          concurrency: 4,
        },
      );
      expect(mockWorker.on).toHaveBeenCalledWith(
        'completed',
        expect.any(Function),
      );
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('logs final job failures after retries are exhausted', () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      processor.onModuleInit();
      const failedHandler = mockWorker.on.mock.calls.find(
        ([event]) => event === 'failed',
      )?.[1] as (job: Job | undefined, err: Error) => void;

      failedHandler(
        {
          id: 'job-123',
          attemptsMade: 3,
          opts: { attempts: 3 },
        } as Job,
        new Error('generation failed'),
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Custom briefing job job-123 failed after 3/3 attempts',
        expect.any(String),
      );
    });

    it('logs retryable job failures before attempts are exhausted', () => {
      const loggerWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();

      processor.onModuleInit();
      const failedHandler = mockWorker.on.mock.calls.find(
        ([event]) => event === 'failed',
      )?.[1] as (job: Job | undefined, err: Error) => void;

      failedHandler(
        {
          id: 'job-123',
          attemptsMade: 1,
          opts: { attempts: 3 },
        } as Job,
        new Error('generation failed'),
      );

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Custom briefing job job-123 failed attempt 1/3; retry scheduled: generation failed',
      );
    });
  });

  describe('processCustomBriefing', () => {
    it('generates a custom briefing and returns the briefing id', async () => {
      mockBriefingGenerationService.generateCustomBrief.mockResolvedValue({
        success: true,
        briefingId: 'briefing-uuid',
      });

      const result = await processor.processCustomBriefing({
        id: 'job-123',
        data: {
          articleIds: ['article-1', 'article-2'],
          feedProfile: FeedProfile.DEFAULT,
          customPrompt: 'Focus on impact',
        },
      } as Job);

      expect(mockBriefingGenerationService.generateCustomBrief).toHaveBeenCalledWith(
        ['article-1', 'article-2'],
        FeedProfile.DEFAULT,
        'Focus on impact',
      );
      expect(result).toEqual({ briefingId: 'briefing-uuid' });
    });

    it('throws when custom briefing generation fails', async () => {
      mockBriefingGenerationService.generateCustomBrief.mockResolvedValue({
        success: false,
        error: 'No articles with processed content found',
      });

      await expect(
        processor.processCustomBriefing({
          id: 'job-123',
          data: {
            articleIds: ['article-1', 'article-2'],
            feedProfile: FeedProfile.DEFAULT,
          },
        } as Job),
      ).rejects.toThrow('No articles with processed content found');
    });
  });
});
