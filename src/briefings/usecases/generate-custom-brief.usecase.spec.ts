import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { QueueService } from '../../../libs/queue/queue.service';
import { FeedProfile } from '../../shared/types/feed';
import { GenerateCustomBriefUseCase } from './generate-custom-brief.usecase';

describe('GenerateCustomBriefUseCase', () => {
  let useCase: GenerateCustomBriefUseCase;
  const mockQueueService = mock<QueueService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateCustomBriefUseCase,
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    useCase = module.get<GenerateCustomBriefUseCase>(GenerateCustomBriefUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queues a custom briefing job for valid input', async () => {
    mockQueueService.addCustomBriefingJob.mockResolvedValue({ jobId: 'job-123' });

    const result = await useCase.execute({
      articleIds: ['article-1', 'article-2'],
      feedProfile: FeedProfile.DEFAULT,
      customPrompt: 'Focus on risks',
    });

    expect(mockQueueService.addCustomBriefingJob).toHaveBeenCalledWith({
      articleIds: ['article-1', 'article-2'],
      feedProfile: FeedProfile.DEFAULT,
      customPrompt: 'Focus on risks',
    });
    expect(result).toEqual({ jobId: 'job-123' });
  });

  it('rejects invalid feed profiles', async () => {
    await expect(
      useCase.execute({
        articleIds: ['article-1', 'article-2'],
        feedProfile: 'invalid-profile' as FeedProfile,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockQueueService.addCustomBriefingJob).not.toHaveBeenCalled();
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
