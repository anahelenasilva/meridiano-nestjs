import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { CategorizeArticlesUseCase } from './categorize-articles.usecase';
import { RunBriefingInputDto } from './dto/run-briefing.dto';
import { GenerateBriefUseCase } from './generate-brief.usecase';
import { ProcessArticlesUseCase } from './process-articles.usecase';
import { RateArticlesUseCase } from './rate-articles.usecase';
import { RunBriefingUseCase } from './run-briefing.usecase';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';

describe('RunBriefingUseCase', () => {
  let useCase: RunBriefingUseCase;
  const mockScrapeArticlesUseCase = mock<ScrapeArticlesUseCase>();
  const mockProcessArticlesUseCase = mock<ProcessArticlesUseCase>();
  const mockRateArticlesUseCase = mock<RateArticlesUseCase>();
  const mockCategorizeArticlesUseCase = mock<CategorizeArticlesUseCase>();
  const mockGenerateBriefUseCase = mock<GenerateBriefUseCase>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunBriefingUseCase,
        { provide: ScrapeArticlesUseCase, useValue: mockScrapeArticlesUseCase },
        {
          provide: ProcessArticlesUseCase,
          useValue: mockProcessArticlesUseCase,
        },
        { provide: RateArticlesUseCase, useValue: mockRateArticlesUseCase },
        {
          provide: CategorizeArticlesUseCase,
          useValue: mockCategorizeArticlesUseCase,
        },
        { provide: GenerateBriefUseCase, useValue: mockGenerateBriefUseCase },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    useCase = module.get<RunBriefingUseCase>(RunBriefingUseCase);

    mockScrapeArticlesUseCase.execute.mockResolvedValue({
      status: 'scraped',
      rss: { newArticles: 5, errors: 0 },
      sitemap: { newArticles: 3, errors: 2 },
    });
    mockProcessArticlesUseCase.execute.mockResolvedValue({
      articlesProcessed: 8,
      errors: 0,
    });
    mockRateArticlesUseCase.execute.mockResolvedValue({
      articlesRated: 8,
      errors: 0,
    });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({
      articlesCategorized: 8,
      errors: 0,
    });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input: RunBriefingInputDto = { feedProfile: FeedProfile.DEFAULT };

  it('returns an error and stops when the profile has no sources', async () => {
    mockScrapeArticlesUseCase.execute.mockResolvedValue({
      status: 'no_sources',
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      "No enabled feeds or sitemap sources found for profile 'default'",
    );
    expect(mockProcessArticlesUseCase.execute).not.toHaveBeenCalled();
  });

  it('runs all stages and returns success when generation enabled', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockGenerateBriefUseCase.execute.mockResolvedValue({
      success: true,
      briefingId: 'brief-uuid',
      stats: { articlesAnalyzed: 8, clustersUsed: 2 },
    });

    const result = await useCase.execute(input);

    expect(mockScrapeArticlesUseCase.execute).toHaveBeenCalledWith({
      feedProfile: FeedProfile.DEFAULT,
    });
    expect(result.success).toBe(true);
    expect(result.stages?.processing.articlesProcessed).toBe(8);
    expect(result.stages?.rating.articlesRated).toBe(8);
    expect(result.stages?.categorization.articlesCategorized).toBe(8);
    expect(result.stages?.briefGeneration.briefingId).toBe('brief-uuid');
  });

  it('reports RSS and sitemap scraping stats separately', async () => {
    const result = await useCase.execute(input);

    expect(result.stages?.scraping).toEqual({ newArticles: 5, errors: 0 });
    expect(result.stages?.sitemapScraping).toEqual({
      newArticles: 3,
      errors: 2,
    });
  });

  it('skips brief generation when feature flag disabled', async () => {
    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(mockGenerateBriefUseCase.execute).not.toHaveBeenCalled();
    expect(result.stages?.briefGeneration.error).toContain('disabled');
  });

  it('propagates stage failure', async () => {
    mockScrapeArticlesUseCase.execute.mockRejectedValue(
      new Error('scraper down'),
    );

    await expect(useCase.execute(input)).rejects.toThrow('scraper down');
  });
});
