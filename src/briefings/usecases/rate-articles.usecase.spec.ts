import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ProcessorService } from '../../processor/processor.service';
import { FeedProfile } from '../../shared/types/feed';
import { ProcessingStats } from '../../shared/types/ai';
import { RateArticlesUseCase } from './rate-articles.usecase';

const baseStats: ProcessingStats = {
  feedProfile: FeedProfile.DEFAULT,
  articlesProcessed: 0,
  articlesRated: 0,
  articlesCategorized: 0,
  errors: 0,
  startTime: new Date(),
};

describe('RateArticlesUseCase', () => {
  let useCase: RateArticlesUseCase;
  const mockProcessorService = mock<ProcessorService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateArticlesUseCase,
        { provide: ProcessorService, useValue: mockProcessorService },
      ],
    }).compile();

    useCase = module.get<RateArticlesUseCase>(RateArticlesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to processorService and maps stats', async () => {
    const stats: ProcessingStats = { ...baseStats, articlesRated: 6, errors: 0 };
    mockProcessorService.rateArticles.mockResolvedValue(stats);

    const result = await useCase.execute({ feedProfile: FeedProfile.DEFAULT });

    expect(mockProcessorService.rateArticles).toHaveBeenCalledWith(FeedProfile.DEFAULT);
    expect(result).toEqual({ articlesRated: 6, errors: 0 });
  });

  it('propagates service errors', async () => {
    mockProcessorService.rateArticles.mockRejectedValue(new Error('rating failed'));

    await expect(
      useCase.execute({ feedProfile: FeedProfile.DEFAULT }),
    ).rejects.toThrow('rating failed');
  });
});
