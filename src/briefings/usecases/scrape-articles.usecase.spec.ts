import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ProfilesService } from '../../profiles/profiles.service';
import { ScraperService } from '../../scraper/scraper.service';
import { FeedProfile } from '../../shared/types/feed';
import { ScrapingStats } from '../../scraper/scrapper.entity';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';

describe('ScrapeArticlesUseCase', () => {
  let useCase: ScrapeArticlesUseCase;
  const mockScraperService = mock<ScraperService>();
  const mockProfilesService = mock<ProfilesService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapeArticlesUseCase,
        { provide: ScraperService, useValue: mockScraperService },
        { provide: ProfilesService, useValue: mockProfilesService },
      ],
    }).compile();

    useCase = module.get<ScrapeArticlesUseCase>(ScrapeArticlesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to scraperService and maps stats', async () => {
    const stats: ScrapingStats = {
      feedProfile: FeedProfile.DEFAULT,
      totalFeeds: 2,
      newArticles: 7,
      errors: 1,
      startTime: new Date(),
    };
    mockScraperService.scrapeArticles.mockResolvedValue(stats);

    const result = await useCase.execute({
      feedProfile: FeedProfile.DEFAULT,
      feedUrls: ['https://a.com/feed', 'https://b.com/feed'],
    });

    expect(mockScraperService.scrapeArticles).toHaveBeenCalledWith(FeedProfile.DEFAULT, [
      'https://a.com/feed',
      'https://b.com/feed',
    ]);
    expect(result).toEqual({ newArticles: 7, errors: 1 });
  });

  it('propagates service errors', async () => {
    mockScraperService.scrapeArticles.mockRejectedValue(new Error('feed timeout'));

    await expect(
      useCase.execute({ feedProfile: FeedProfile.DEFAULT, feedUrls: [] }),
    ).rejects.toThrow('feed timeout');
  });
});
