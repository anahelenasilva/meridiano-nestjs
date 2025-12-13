import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class CategorizeArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface CategorizeArticlesOutputDto {
  articlesCategorized: number;
  errors: number;
}
