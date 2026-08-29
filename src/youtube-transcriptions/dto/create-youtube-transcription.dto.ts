import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateYoutubeTranscriptionDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(25, { message: 'A batch may contain at most 25 URLs' })
  @IsUrl({}, { each: true, message: 'Invalid URL format' })
  urls: string[];

  @IsNotEmpty()
  @IsString()
  channelId: string;

  // Applies to every video in the batch.
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'customPrompt must not exceed 500 characters',
  })
  customPrompt?: string;

  // Applies to every video in the batch.
  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;
}
