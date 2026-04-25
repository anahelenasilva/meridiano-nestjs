import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ProcessorService } from '../../processor/processor.service';
import { FeedProfile } from '../../shared/types/feed';
import { ProcessingStats } from '../../shared/types/ai';
import { ProcessArticlesUseCase } from './process-articles.usecase';

const baseStats: ProcessingStats = {
  feedProfile: FeedProfile.DEFAULT,
  articlesProcessed: 0,
  articlesRated: 0,
  articlesCategorized: 0,
  errors: 0,
  startTime: new Date(),
};

describe('ProcessArticlesUseCase', () => {
  let useCase: ProcessArticlesUseCase;
  const mockProcessorService = mock<ProcessorService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessArticlesUseCase,
        { provide: ProcessorService, useValue: mockProcessorService },
      ],
    }).compile();

    useCase = module.get<ProcessArticlesUseCase>(ProcessArticlesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to processorService and maps stats', async () => {
    const stats: ProcessingStats = { ...baseStats, articlesProcessed: 4, errors: 0 };
    mockProcessorService.processArticles.mockResolvedValue(stats);

    const result = await useCase.execute({ feedProfile: FeedProfile.DEFAULT });

    expect(mockProcessorService.processArticles).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
      1000,
      undefined,
      undefined,
    );
    expect(result).toEqual({ articlesProcessed: 4, errors: 0 });
  });

  it('propagates service errors', async () => {
    mockProcessorService.processArticles.mockRejectedValue(new Error('processor error'));

    await expect(
      useCase.execute({ feedProfile: FeedProfile.DEFAULT }),
    ).rejects.toThrow('processor error');
  });
});
