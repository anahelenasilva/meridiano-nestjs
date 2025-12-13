import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class RateArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface RateArticlesOutputDto {
  articlesRated: number;
  errors: number;
}
