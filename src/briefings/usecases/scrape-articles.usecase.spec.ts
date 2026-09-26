import { mock } from 'jest-mock-extended';
import { ScraperService } from '../../scraper/scraper.service';
import { ScrapingStats } from '../../scraper/scrapper.entity';
import { FeedProfile } from '../../shared/types/feed';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';

function stats(newArticles: number, errors: number): ScrapingStats {
  return {
    feedProfile: FeedProfile.DEFAULT,
    totalFeeds: 1,
    newArticles,
    errors,
    startTime: new Date(),
  };
}

describe('ScrapeArticlesUseCase', () => {
  const scraperService = mock<ScraperService>();
  const useCase = new ScrapeArticlesUseCase(scraperService);

  afterEach(() => jest.clearAllMocks());

  it('maps RSS and sitemap stats for a scraped profile', async () => {
    scraperService.scrapeFeedProfile.mockResolvedValue({
      status: 'scraped',
      rss: stats(7, 1),
      sitemap: stats(2, 0),
    });

    const result = await useCase.execute({ feedProfile: FeedProfile.DEFAULT });

    expect(scraperService.scrapeFeedProfile).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
    expect(result).toEqual({
      status: 'scraped',
      rss: { newArticles: 7, errors: 1 },
      sitemap: { newArticles: 2, errors: 0 },
    });
  });

  it('passes through a profile with no sources', async () => {
    scraperService.scrapeFeedProfile.mockResolvedValue({
      status: 'no_sources',
    });

    const result = await useCase.execute({ feedProfile: FeedProfile.DEFAULT });

    expect(result).toEqual({ status: 'no_sources' });
  });

  it('propagates scraper errors', async () => {
    scraperService.scrapeFeedProfile.mockRejectedValue(
      new Error('feed timeout'),
    );

    await expect(
      useCase.execute({ feedProfile: FeedProfile.DEFAULT }),
    ).rejects.toThrow('feed timeout');
  });
});
