import { Injectable } from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type ListAllYoutubeTranscriptionsResponse = {
  transcriptions: any[];
  available_channels: { id: string; name: string }[];
};

@Injectable()
export class ListAllYoutubeTranscriptionsQuery {
  constructor(private readonly service: YoutubeTranscriptionsService) {}

  async execute(): Promise<ListAllYoutubeTranscriptionsResponse | null> {
    const transcriptions = await this.service.getAllTranscriptions();
    const availableChannels = await this.service.getDistinctChannels();

    return {
      transcriptions,
      available_channels: availableChannels,
    };
  }
}
