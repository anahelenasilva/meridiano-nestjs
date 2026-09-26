import { IsEnum } from 'class-validator';
import { ScrapingStats } from '../../../scraper/scrapper.entity';
import { ProcessingStats } from '../../../shared/types/ai';
import { FeedProfile } from '../../../shared/types/feed';
import { GenerateBriefOutputDto } from './generate-brief.dto';

export class RunBriefingInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface RunBriefingOutputDto {
  success: boolean;
  duration: number;
  error?: string;
  stages?: {
    scraping: ScrapingStats;
    sitemapScraping: ScrapingStats;
    processing: ProcessingStats;
    rating: ProcessingStats;
    categorization: ProcessingStats;
    briefGeneration: GenerateBriefOutputDto;
  };
}
