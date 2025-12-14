import { Injectable } from '@nestjs/common';
import { ProfilesService } from '../../profiles/profiles.service';
import { ScraperService } from '../../scraper/scraper.service';
import {
  ScrapeArticlesInputDto,
  ScrapeArticlesOutputDto,
} from './dto/scrape-articles.dto';

@Injectable()
export class ScrapeArticlesUseCase {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly profilesService: ProfilesService,
  ) { }

  async execute(
    input: ScrapeArticlesInputDto,
  ): Promise<ScrapeArticlesOutputDto> {
    const stats = await this.scraperService.scrapeArticles(
      input.feedProfile,
      input.feedUrls,
    );

    return {
      newArticles: stats.newArticles,
      errors: stats.errors,
    };
  }
}
