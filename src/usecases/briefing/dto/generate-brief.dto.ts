import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class GenerateBriefInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;

  @IsOptional()
  @IsBoolean()
  simple?: boolean;
}

export interface GenerateBriefOutputDto {
  success: boolean;
  briefingId?: number;
  stats?: {
    articlesAnalyzed: number;
    clustersUsed: number;
  };
  error?: string;
}
