import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';

export class CreateArticleDto {
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsNotEmpty()
  @IsEnum(FeedProfile, { message: 'Invalid feed profile' })
  @IsString()
  feedProfile: FeedProfile;
}
