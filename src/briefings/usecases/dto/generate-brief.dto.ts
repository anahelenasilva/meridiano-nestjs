import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

export class CustomPromptsDto {
  @IsOptional()
  @IsString()
  clusterAnalysis?: string;

  @IsOptional()
  @IsString()
  briefSynthesis?: string;
}

export class GenerateBriefInputDto {
  @IsEnum(FeedProfile)
  feedProfile: FeedProfile;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomPromptsDto)
  customPrompts?: CustomPromptsDto;
}

export interface GenerateBriefOutputDto {
  success: boolean;
  briefingId?: string;
  stats?: {
    articlesAnalyzed: number;
    clustersUsed: number;
  };
  error?: string;
}
