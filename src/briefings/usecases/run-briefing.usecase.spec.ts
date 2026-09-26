import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { ProcessorService } from '../../processor/processor.service';
import { ScraperService } from '../../scraper/scraper.service';
import { ScrapingStats } from '../../scraper/scrapper.entity';
import { ProcessingStats } from '../../shared/types/ai';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import { GenerateBriefUseCase } from './generate-brief.usecase';
import { RunBriefingUseCase } from './run-briefing.usecase';

const scrapingStats = (newArticles: number, errors: number): ScrapingStats => ({
  feedProfile: FeedProfile.DEFAULT,
  totalFeeds: 1,
  newArticles,
  errors,
  startTime: new Date(),
});

const processingStats = (
  counts: Partial<ProcessingStats>,
): ProcessingStats => ({
  feedProfile: FeedProfile.DEFAULT,
  articlesProcessed: 0,
  articlesRated: 0,
  articlesCategorized: 0,
  errors: 0,
  startTime: new Date(),
  ...counts,
});

describe('RunBriefingUseCase', () => {
  let useCase: RunBriefingUseCase;
  const scraperService = mock<ScraperService>();
  const processorService = mock<ProcessorService>();
  const briefingGenerationService = mock<BriefingGenerationService>();
  const configService = mock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunBriefingUseCase,
        GenerateBriefUseCase,
        { provide: ScraperService, useValue: scraperService },
        { provide: ProcessorService, useValue: processorService },
        {
          provide: BriefingGenerationService,
          useValue: briefingGenerationService,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    useCase = module.get(RunBriefingUseCase);

    scraperService.scrapeFeedProfile.mockResolvedValue({
      status: 'scraped',
      rss: scrapingStats(5, 0),
      sitemap: scrapingStats(3, 2),
    });
    processorService.processArticles.mockResolvedValue(
      processingStats({ articlesProcessed: 8 }),
    );
    processorService.rateArticles.mockResolvedValue(
      processingStats({ articlesRated: 7 }),
    );
    processorService.categorizeArticles.mockResolvedValue(
      processingStats({ articlesCategorized: 6, errors: 1 }),
    );
    configService.isBriefingsGenerationEnabled.mockReturnValue(true);
    briefingGenerationService.generateBrief.mockResolvedValue({
      success: true,
      briefingId: 'brief-uuid',
      stats: { articlesAnalyzed: 8, clustersGenerated: 3, clustersUsed: 2 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input = { feedProfile: FeedProfile.DEFAULT };

  it('scrapes, processes, rates, categorises and generates a brief when the profile has sources', async () => {
    const result = await useCase.execute(input);

    expect(scraperService.scrapeFeedProfile).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
    expect(processorService.processArticles).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
    expect(processorService.rateArticles).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
    expect(processorService.categorizeArticles).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
    expect(briefingGenerationService.generateBrief).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
      { customPrompts: undefined },
    );
    expect(result.success).toBe(true);
    expect(result.stages).toMatchObject({
      scraping: { newArticles: 5, errors: 0 },
      sitemapScraping: { newArticles: 3, errors: 2 },
      processing: { articlesProcessed: 8, errors: 0 },
      rating: { articlesRated: 7, errors: 0 },
      categorization: { articlesCategorized: 6, errors: 1 },
      briefGeneration: { success: true, briefingId: 'brief-uuid' },
    });
  });

  it('returns an error and runs no other stage when the profile has no sources', async () => {
    scraperService.scrapeFeedProfile.mockResolvedValue({
      status: 'no_sources',
    });

    const result = await useCase.execute(input);

    expect(result).toEqual({
      success: false,
      duration: 0,
      error: "No enabled feeds or sitemap sources found for profile 'default'.",
    });
    expect(processorService.processArticles).not.toHaveBeenCalled();
    expect(briefingGenerationService.generateBrief).not.toHaveBeenCalled();
  });

  it('runs every stage but skips the brief when generation is disabled', async () => {
    configService.isBriefingsGenerationEnabled.mockReturnValue(false);

    const result = await useCase.execute(input);

    expect(processorService.categorizeArticles).toHaveBeenCalled();
    expect(briefingGenerationService.generateBrief).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.stages?.briefGeneration).toEqual({
      success: false,
      error:
        'Briefings generation is disabled. Set ENABLE_BRIEFINGS_GENERATION=true to enable.',
    });
  });
});
