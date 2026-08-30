import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ScrapeArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  feedUrls?: string[];
}

export interface ScrapeArticlesOutputDto {
  newArticles: number;
  errors: number;
}
