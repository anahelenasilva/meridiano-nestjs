import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateYoutubeTranscriptionDto {
  @IsNotEmpty()
  @IsUrl({}, { message: 'Invalid URL format' })
  url: string;

  @IsNotEmpty()
  @IsString()
  channelId: string;
}
