import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

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
  @ValidateNested()
  @Type(() => ExternalSubmissionMetadataDto)
  metadata?: ExternalSubmissionMetadataDto;
}
