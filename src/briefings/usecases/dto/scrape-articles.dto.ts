import { IsEnum } from 'class-validator';
import { ScrapingStats } from '../../../scraper/scrapper.entity';
import { FeedProfile } from '../../../shared/types/feed';

export class ScrapeArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

type ScrapeStats = Pick<ScrapingStats, 'newArticles' | 'errors'>;

export type ScrapeArticlesOutputDto =
  | { status: 'no_sources' }
  | { status: 'scraped'; rss: ScrapeStats; sitemap: ScrapeStats };
