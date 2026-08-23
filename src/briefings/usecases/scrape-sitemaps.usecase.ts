import { Injectable } from '@nestjs/common';
import { ScraperService } from '../../scraper/scraper.service';
import {
  ScrapeSitemapsInputDto,
  ScrapeSitemapsOutputDto,
} from './dto/scrape-sitemaps.dto';

@Injectable()
export class ScrapeSitemapsUseCase {
  constructor(private readonly scraperService: ScraperService) {}

  async execute(
    input: ScrapeSitemapsInputDto,
  ): Promise<ScrapeSitemapsOutputDto> {
    const stats = await this.scraperService.scrapeSitemaps(input.feedProfile);

    return {
      newArticles: stats.newArticles,
      errors: stats.errors,
    };
  }
}
