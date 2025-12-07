import { Injectable } from '@nestjs/common';
import { YoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions.service';

export type GetYoutubeTranscriptionByIdResponse = {
  transcription: YoutubeTranscription;
};

@Injectable()
export class GetYoutubeTranscriptionByIdQuery {
  constructor(private readonly service: YoutubeTranscriptionsService) {}

  async execute(
    id: number,
  ): Promise<GetYoutubeTranscriptionByIdResponse | null> {
    const transcription = await this.service.getTranscriptionById(id);

    if (!transcription) {
      return null;
    }

    return {
      transcription,
    };
  }
}
