import { IsOptional, IsString } from 'class-validator';
import { YoutubeTranscription } from '../../../youtube-transcriptions/entities/youtube-transcription.entity';

export class ListTranscriptionsInputDto {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  channelName?: string;
}

export interface ListTranscriptionsOutputDto {
  transcriptions: YoutubeTranscription[];
  statistics: {
    total: number;
    withSummary: number;
    withoutSummary: number;
    channelCounts: Record<string, number>;
  };
}
