import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ScrapeArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface ScrapeStats {
  newArticles: number;
  errors: number;
}

export type ScrapeArticlesOutputDto =
  | { status: 'no_sources' }
  | { status: 'scraped'; rss: ScrapeStats; sitemap: ScrapeStats };
