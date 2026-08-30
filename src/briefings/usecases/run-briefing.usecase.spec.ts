import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { FeedProfile, RSSFeed } from '../../shared/types/feed';
import { CategorizeArticlesUseCase } from './categorize-articles.usecase';
import { RunBriefingInputDto } from './dto/run-briefing.dto';
import { GenerateBriefUseCase } from './generate-brief.usecase';
import { ProcessArticlesUseCase } from './process-articles.usecase';
import { RateArticlesUseCase } from './rate-articles.usecase';
import { RunBriefingUseCase } from './run-briefing.usecase';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';
import { ScrapeSitemapsUseCase } from './scrape-sitemaps.usecase';

const enabledFeed: RSSFeed = { url: 'https://example.com/feed', name: 'Example' };

describe('RunBriefingUseCase', () => {
  let useCase: RunBriefingUseCase;
  const mockScrapeArticlesUseCase = mock<ScrapeArticlesUseCase>();
  const mockScrapeSitemapsUseCase = mock<ScrapeSitemapsUseCase>();
  const mockProcessArticlesUseCase = mock<ProcessArticlesUseCase>();
  const mockRateArticlesUseCase = mock<RateArticlesUseCase>();
  const mockCategorizeArticlesUseCase = mock<CategorizeArticlesUseCase>();
  const mockGenerateBriefUseCase = mock<GenerateBriefUseCase>();
  const mockProfilesService = mock<ProfilesService>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunBriefingUseCase,
        { provide: ScrapeArticlesUseCase, useValue: mockScrapeArticlesUseCase },
        { provide: ScrapeSitemapsUseCase, useValue: mockScrapeSitemapsUseCase },
        { provide: ProcessArticlesUseCase, useValue: mockProcessArticlesUseCase },
        { provide: RateArticlesUseCase, useValue: mockRateArticlesUseCase },
        { provide: CategorizeArticlesUseCase, useValue: mockCategorizeArticlesUseCase },
        { provide: GenerateBriefUseCase, useValue: mockGenerateBriefUseCase },
        { provide: ProfilesService, useValue: mockProfilesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    useCase = module.get<RunBriefingUseCase>(RunBriefingUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input: RunBriefingInputDto = { feedProfile: FeedProfile.DEFAULT };

  it('returns error immediately when no enabled feeds', async () => {
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([]);

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No enabled feeds found for profile 'default'");
    expect(mockScrapeArticlesUseCase.execute).not.toHaveBeenCalled();
  });

  it('runs all stages and returns success when generation enabled', async () => {
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([enabledFeed]);
    mockScrapeArticlesUseCase.execute.mockResolvedValue({ newArticles: 5, errors: 0 });
    mockScrapeSitemapsUseCase.execute.mockResolvedValue({ newArticles: 3, errors: 0 });
    mockProcessArticlesUseCase.execute.mockResolvedValue({ articlesProcessed: 5, errors: 0 });
    mockRateArticlesUseCase.execute.mockResolvedValue({ articlesRated: 5, errors: 0 });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({ articlesCategorized: 5, errors: 0 });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockGenerateBriefUseCase.execute.mockResolvedValue({
      success: true,
      briefingId: 'brief-uuid',
      stats: { articlesAnalyzed: 5, clustersUsed: 2 },
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(true);
    expect(result.stages?.scraping.newArticles).toBe(5);
    expect(result.stages?.sitemapScraping.newArticles).toBe(3);
    expect(result.stages?.processing.articlesProcessed).toBe(5);
    expect(result.stages?.rating.articlesRated).toBe(5);
    expect(result.stages?.categorization.articlesCategorized).toBe(5);
    expect(result.stages?.briefGeneration.briefingId).toBe('brief-uuid');
  });

  it('skips brief generation when feature flag disabled', async () => {
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([enabledFeed]);
    mockScrapeArticlesUseCase.execute.mockResolvedValue({ newArticles: 0, errors: 0 });
    mockProcessArticlesUseCase.execute.mockResolvedValue({ articlesProcessed: 0, errors: 0 });
    mockRateArticlesUseCase.execute.mockResolvedValue({ articlesRated: 0, errors: 0 });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({ articlesCategorized: 0, errors: 0 });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(mockGenerateBriefUseCase.execute).not.toHaveBeenCalled();
    expect(result.stages?.briefGeneration.error).toContain('disabled');
  });

  it('propagates stage failure', async () => {
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([enabledFeed]);
    mockScrapeArticlesUseCase.execute.mockRejectedValue(new Error('scraper down'));

    await expect(useCase.execute(input)).rejects.toThrow('scraper down');
  });

  it('passes feed urls from enabled feeds to scrape use case', async () => {
    const feeds: RSSFeed[] = [
      { url: 'https://a.com/feed', name: 'A' },
      { url: 'https://b.com/feed', name: 'B' },
    ];
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue(feeds);
    mockScrapeArticlesUseCase.execute.mockResolvedValue({ newArticles: 0, errors: 0 });
    mockProcessArticlesUseCase.execute.mockResolvedValue({ articlesProcessed: 0, errors: 0 });
    mockRateArticlesUseCase.execute.mockResolvedValue({ articlesRated: 0, errors: 0 });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({ articlesCategorized: 0, errors: 0 });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);

    await useCase.execute(input);

    expect(mockScrapeArticlesUseCase.execute).toHaveBeenCalledWith({
      feedProfile: FeedProfile.DEFAULT,
      feedUrls: ['https://a.com/feed', 'https://b.com/feed'],
    });
  });

  it('scrapes sitemaps for the profile after RSS and before processing', async () => {
    const callOrder: string[] = [];

    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([enabledFeed]);
    mockScrapeArticlesUseCase.execute.mockImplementation(async () => {
      callOrder.push('rss');
      return { newArticles: 5, errors: 0 };
    });
    mockScrapeSitemapsUseCase.execute.mockImplementation(async () => {
      callOrder.push('sitemap');
      return { newArticles: 3, errors: 0 };
    });
    mockProcessArticlesUseCase.execute.mockImplementation(async () => {
      callOrder.push('process');
      return { articlesProcessed: 8, errors: 0 };
    });
    mockRateArticlesUseCase.execute.mockResolvedValue({ articlesRated: 8, errors: 0 });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({
      articlesCategorized: 8,
      errors: 0,
    });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);

    await useCase.execute(input);

    expect(mockScrapeSitemapsUseCase.execute).toHaveBeenCalledWith({
      feedProfile: FeedProfile.DEFAULT,
    });
    expect(callOrder).toEqual(['rss', 'sitemap', 'process']);
  });

  it('reports sitemap errors separately from RSS errors', async () => {
    mockProfilesService.getEnabledFeedsForProfile.mockReturnValue([enabledFeed]);
    mockScrapeArticlesUseCase.execute.mockResolvedValue({ newArticles: 5, errors: 0 });
    mockScrapeSitemapsUseCase.execute.mockResolvedValue({ newArticles: 0, errors: 2 });
    mockProcessArticlesUseCase.execute.mockResolvedValue({ articlesProcessed: 5, errors: 0 });
    mockRateArticlesUseCase.execute.mockResolvedValue({ articlesRated: 5, errors: 0 });
    mockCategorizeArticlesUseCase.execute.mockResolvedValue({
      articlesCategorized: 5,
      errors: 0,
    });
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);

    const result = await useCase.execute(input);

    expect(result.stages?.scraping.errors).toBe(0);
    expect(result.stages?.sitemapScraping.errors).toBe(2);
    expect(result.stages?.sitemapScraping.newArticles).toBe(0);
  });
});
