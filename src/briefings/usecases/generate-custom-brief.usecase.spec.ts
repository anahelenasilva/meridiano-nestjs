import { BadRequestException } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { GENERATE_CUSTOM_BRIEFING_JOB } from '../../../libs/queue/constants/queue.constants';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { GenerateCustomBriefUseCase } from './generate-custom-brief.usecase';

describe('GenerateCustomBriefUseCase', () => {
  let useCase: GenerateCustomBriefUseCase;
  const mockQueue = mock<Queue>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(() => {
    mockQueue.add.mockResolvedValue({ id: 'job-123' } as Job);
    mockConfigService.getCustomBriefingQueueConfig.mockReturnValue({
      concurrency: 1,
      attempts: 4,
      backoffDelayMs: 7000,
    });
    useCase = new GenerateCustomBriefUseCase(mockQueue, mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queues a curated briefing job with retry options from config', async () => {
    const result = await useCase.execute({
      articleIds: ['a', 'b'],
      feedProfile: FeedProfile.TECHNOLOGY,
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      GENERATE_CUSTOM_BRIEFING_JOB,
      { articleIds: ['a', 'b'], feedProfile: FeedProfile.TECHNOLOGY, customPrompt: undefined },
      { attempts: 4, backoff: { type: 'exponential', delay: 7000 } },
    );
    expect(result).toEqual({ jobId: 'job-123' });
  });

  it('passes the Briefing Focus Instruction into the job', async () => {
    await useCase.execute({
      articleIds: ['a', 'b'],
      feedProfile: FeedProfile.DEFAULT,
      customPrompt: 'Focus on risks',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      GENERATE_CUSTOM_BRIEFING_JOB,
      expect.objectContaining({ customPrompt: 'Focus on risks' }),
      expect.any(Object),
    );
  });

  it('rejects invalid feed profiles', async () => {
    await expect(
      useCase.execute({
        articleIds: ['article-1', 'article-2'],
        feedProfile: 'invalid-profile' as FeedProfile,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('requires at least two articles', async () => {
    await expect(
      useCase.execute({
        articleIds: ['article-1'],
        feedProfile: FeedProfile.DEFAULT,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows no more than ten articles', async () => {
    await expect(
      useCase.execute({
        articleIds: Array.from({ length: 11 }, (_, index) => `article-${index}`),
        feedProfile: FeedProfile.DEFAULT,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
