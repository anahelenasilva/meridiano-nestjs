import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class ProcessArticlesInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;
}

export interface ProcessArticlesOutputDto {
  articlesProcessed: number;
  errors: number;
}
