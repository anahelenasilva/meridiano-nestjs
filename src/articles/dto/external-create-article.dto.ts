import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

const CUSTOM_PROMPT_MAX_LENGTH = 500;

export class ExternalSubmissionMetadataDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ExternalCreateArticleDto {
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsNotEmpty()
  @IsEnum(FeedProfile, { message: 'Invalid feed profile' })
  feedProfile: FeedProfile;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_PROMPT_MAX_LENGTH, {
    message: `customPrompt must not exceed ${CUSTOM_PROMPT_MAX_LENGTH} characters`,
  })
  customPrompt?: string;

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalSubmissionMetadataDto)
  metadata?: ExternalSubmissionMetadataDto;
}
