import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class RunBriefingInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface RunBriefingOutputDto {
  success: boolean;
  duration: number;
  error?: string;
  stages?: {
    scraping: {
      newArticles: number;
      errors: number;
    };
    sitemapScraping: {
      newArticles: number;
      errors: number;
    };
    processing: {
      articlesProcessed: number;
      errors: number;
    };
    rating: {
      articlesRated: number;
      errors: number;
    };
    categorization: {
      articlesCategorized: number;
      errors: number;
    };
    briefGeneration: {
      success: boolean;
      briefingId?: string;
      stats?: {
        articlesAnalyzed: number;
        clustersUsed: number;
      };
      error?: string;
    };
  };
}
