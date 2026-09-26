import { Logger } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { createWorker } from '../../../libs/queue/create-worker';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import { CustomBriefingProcessor } from './custom-briefing.processor';

jest.mock('../../../libs/queue/create-worker');

describe('CustomBriefingProcessor', () => {
  let processor: CustomBriefingProcessor;
  const mockQueue = mock<Queue>();
  const mockBriefingGenerationService = mock<BriefingGenerationService>();
  const mockConfigService = mock<ConfigService>();
  const mockWorker = mock<Worker>();

  beforeEach(() => {
    jest.mocked(createWorker).mockReturnValue(mockWorker);
    mockConfigService.getCustomBriefingQueueConfig.mockReturnValue({
      concurrency: 4,
      attempts: 3,
      backoffDelayMs: 5000,
    });

    processor = new CustomBriefingProcessor(
      mockQueue,
      mockBriefingGenerationService,
      mockConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('starts a worker on the curated briefing queue with configured concurrency', () => {
      processor.onModuleInit();

      expect(createWorker).toHaveBeenCalledWith(mockQueue, expect.any(Function), {
        logger: expect.any(Logger),
        concurrency: 4,
      });
    });
  });

  describe('processCustomBriefing', () => {
    it('generates a custom briefing and returns the briefing id with custom title', async () => {
      mockBriefingGenerationService.generateCustomBrief.mockResolvedValue({
        success: true,
        briefingId: 'briefing-uuid',
        customTitle: 'Generated Title',
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
      expect(result).toEqual({
        briefingId: 'briefing-uuid',
        customTitle: 'Generated Title',
      });
    });

    it('returns null custom title when generation did not produce one', async () => {
      mockBriefingGenerationService.generateCustomBrief.mockResolvedValue({
        success: true,
        briefingId: 'briefing-uuid',
      });

      const result = await processor.processCustomBriefing({
        id: 'job-123',
        data: {
          articleIds: ['article-1', 'article-2'],
          feedProfile: FeedProfile.DEFAULT,
        },
      } as Job);

      expect(result).toEqual({
        briefingId: 'briefing-uuid',
        customTitle: null,
      });
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
