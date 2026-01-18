import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

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
}
