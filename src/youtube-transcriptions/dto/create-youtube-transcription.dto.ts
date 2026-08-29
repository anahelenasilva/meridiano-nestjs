import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateYoutubeTranscriptionDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(25, { message: 'A batch may contain at most 25 URLs' })
  // Not @IsUrl: a stray non-URL line must reach the command and land in
  // `rejected`, not fail the whole batch with a 400. extractVideoId is the
  // single authority on what counts as a YouTube video URL.
  @IsString({ each: true })
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
