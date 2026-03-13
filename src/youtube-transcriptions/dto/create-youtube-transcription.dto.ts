import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateYoutubeTranscriptionDto {
  @IsNotEmpty()
  @IsUrl({}, { message: 'Invalid URL format' })
  url: string;

  @IsNotEmpty()
  @IsString()
  channelId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'customPrompt must not exceed 500 characters',
  })
  customPrompt?: string;
}
