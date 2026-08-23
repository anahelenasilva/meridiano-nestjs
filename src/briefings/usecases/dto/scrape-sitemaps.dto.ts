import { IsEnum } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ScrapeSitemapsInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;
}

export interface ScrapeSitemapsOutputDto {
  newArticles: number;
  errors: number;
}
