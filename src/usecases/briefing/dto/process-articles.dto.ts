import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ProcessArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface ProcessArticlesOutputDto {
  articlesProcessed: number;
  errors: number;
}
