import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ProcessorService } from '../../processor/processor.service';
import { FeedProfile } from '../../shared/types/feed';
import { ProcessingStats } from '../../shared/types/ai';
import { CategorizeArticlesUseCase } from './categorize-articles.usecase';

const baseStats: ProcessingStats = {
  feedProfile: FeedProfile.DEFAULT,
  articlesProcessed: 0,
  articlesRated: 0,
  articlesCategorized: 0,
  errors: 0,
  startTime: new Date(),
};

describe('CategorizeArticlesUseCase', () => {
  let useCase: CategorizeArticlesUseCase;
  const mockProcessorService = mock<ProcessorService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategorizeArticlesUseCase,
        { provide: ProcessorService, useValue: mockProcessorService },
      ],
    }).compile();

    useCase = module.get<CategorizeArticlesUseCase>(CategorizeArticlesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to processorService and maps stats', async () => {
    const stats: ProcessingStats = { ...baseStats, articlesCategorized: 8, errors: 0 };
    mockProcessorService.categorizeArticles.mockResolvedValue(stats);

    const result = await useCase.execute({ feedProfile: FeedProfile.DEFAULT });

    expect(mockProcessorService.categorizeArticles).toHaveBeenCalledWith(FeedProfile.DEFAULT);
    expect(result).toEqual({ articlesCategorized: 8, errors: 0 });
  });

  it('propagates service errors', async () => {
    mockProcessorService.categorizeArticles.mockRejectedValue(new Error('categorization failed'));

    await expect(
      useCase.execute({ feedProfile: FeedProfile.DEFAULT }),
    ).rejects.toThrow('categorization failed');
  });
});
