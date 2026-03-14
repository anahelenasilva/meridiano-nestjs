import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

const CUSTOM_PROMPT_MAX_LENGTH = 500;

export class ProcessMarkdownArticleDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsEnum(FeedProfile)
  @IsNotEmpty()
  feedProfile: FeedProfile;

  @IsString()
  @IsOptional()
  s3Bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_PROMPT_MAX_LENGTH, {
    message: `customPrompt must not exceed ${CUSTOM_PROMPT_MAX_LENGTH} characters`,
  })
  customPrompt?: string;

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;
}
