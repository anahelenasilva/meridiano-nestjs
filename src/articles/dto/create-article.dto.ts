import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

const CUSTOM_PROMPT_MAX_LENGTH = 500;

export class CreateArticleDto {
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsNotEmpty()
  @IsEnum(FeedProfile, { message: 'Invalid feed profile' })
  @IsString()
  feedProfile: FeedProfile;

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
