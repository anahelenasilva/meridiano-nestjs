import { mock } from 'jest-mock-extended';
import { ScraperService } from '../../scraper/scraper.service';
import { FeedProfile } from '../../shared/types/feed';
import { ScrapingStats } from '../../scraper/scrapper.entity';
import { ScrapeSitemapsUseCase } from './scrape-sitemaps.usecase';

describe('ScrapeSitemapsUseCase', () => {
  const scraperService = mock<ScraperService>();
  let useCase: ScrapeSitemapsUseCase;

  beforeEach(() => {
    useCase = new ScrapeSitemapsUseCase(scraperService);
  });

  afterEach(() => jest.clearAllMocks());

  it('delegates to scrapeSitemaps and maps stats', async () => {
    const stats: ScrapingStats = {
      feedProfile: FeedProfile.TECHNOLOGY,
      totalFeeds: 2,
      newArticles: 4,
      errors: 1,
      startTime: new Date(),
    };
    scraperService.scrapeSitemaps.mockResolvedValue(stats);

    const result = await useCase.execute({
      feedProfile: FeedProfile.TECHNOLOGY,
    });

    expect(scraperService.scrapeSitemaps).toHaveBeenCalledWith(
      FeedProfile.TECHNOLOGY,
    );
    expect(result).toEqual({ newArticles: 4, errors: 1 });
  });

  it('propagates service errors', async () => {
    scraperService.scrapeSitemaps.mockRejectedValue(new Error('sitemap down'));

    await expect(
      useCase.execute({ feedProfile: FeedProfile.TECHNOLOGY }),
    ).rejects.toThrow('sitemap down');
  });
});
