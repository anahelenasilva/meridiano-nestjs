import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class RunBriefingInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface RunBriefingOutputDto {
  success: boolean;
  duration: number;
  stages: {
    scraping: {
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
      briefingId?: number;
      stats?: {
        articlesAnalyzed: number;
        clustersUsed: number;
      };
      error?: string;
    };
  };
}
