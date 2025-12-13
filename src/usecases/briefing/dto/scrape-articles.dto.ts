import { IsArray, IsEnum, IsString } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ScrapeArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;

  @IsArray()
  @IsString({ each: true })
  feedUrls: string[];
}

export interface ScrapeArticlesOutputDto {
  newArticles: number;
  errors: number;
}
