import { Injectable } from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../../youtube-transcriptions/youtube-transcriptions.service';
import {
  ExtractYoutubeTranscriptsInputDto,
  ExtractYoutubeTranscriptsOutputDto,
} from './dto/extract-youtube-transcripts.dto';

@Injectable()
export class ExtractYoutubeTranscriptsUseCase {
  constructor(
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) { }

  async execute(
    input: ExtractYoutubeTranscriptsInputDto,
  ): Promise<ExtractYoutubeTranscriptsOutputDto> {
    try {
      await this.youtubeTranscriptionsService.extractAll(input.channels);

      return {
        success: true,
        channelsProcessed: input.channels.length,
      };
    } catch (error) {
      return {
        success: false,
        channelsProcessed: 0,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
