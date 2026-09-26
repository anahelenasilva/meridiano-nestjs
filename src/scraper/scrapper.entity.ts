import { FeedProfile } from '../shared/types/feed';

export interface ScrapingStats {
  feedProfile: FeedProfile;
  totalFeeds: number;
  newArticles: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

export type FeedProfileScrape =
  | { status: 'no_sources' }
  | { status: 'scraped'; rss: ScrapingStats; sitemap: ScrapingStats };
