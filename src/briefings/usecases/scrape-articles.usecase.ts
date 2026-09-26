import { Injectable } from '@nestjs/common';
import { ScraperService } from '../../scraper/scraper.service';
import {
  ScrapeArticlesInputDto,
  ScrapeArticlesOutputDto,
} from './dto/scrape-articles.dto';

@Injectable()
export class ScrapeArticlesUseCase {
  constructor(private readonly scraperService: ScraperService) {}

  async execute(
    input: ScrapeArticlesInputDto,
  ): Promise<ScrapeArticlesOutputDto> {
    const result = await this.scraperService.scrapeFeedProfile(
      input.feedProfile,
    );

    if (result.status === 'no_sources') {
      return result;
    }

    return {
      status: 'scraped',
      rss: { newArticles: result.rss.newArticles, errors: result.rss.errors },
      sitemap: {
        newArticles: result.sitemap.newArticles,
        errors: result.sitemap.errors,
      },
    };
  }
}
