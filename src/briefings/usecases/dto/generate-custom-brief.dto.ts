import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FeedProfile } from '../../../shared/types/feed';

const CUSTOM_PROMPT_MAX_LENGTH = 500;

export class GenerateCustomBriefInputDto {
  // The queue worker casts these to uuid[], so a malformed id would only fail
  // after the client already got a job id.
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  articleIds: string[];

  @IsEnum(FeedProfile, { message: 'Invalid feed profile' })
  feedProfile: FeedProfile;

  // Replaces the profile's prompt template in the AI call. 500 matches the
  // article routes' customPrompt cap.
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_PROMPT_MAX_LENGTH, {
    message: `customPrompt must not exceed ${CUSTOM_PROMPT_MAX_LENGTH} characters`,
  })
  customPrompt?: string;
}
