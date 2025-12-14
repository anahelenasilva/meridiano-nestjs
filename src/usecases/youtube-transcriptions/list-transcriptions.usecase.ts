import { Injectable } from '@nestjs/common';
import { YoutubeTranscriptionsService } from '../../youtube-transcriptions/youtube-transcriptions.service';
import {
  ListTranscriptionsInputDto,
  ListTranscriptionsOutputDto,
} from './dto/list-transcriptions.dto';

@Injectable()
export class ListTranscriptionsUseCase {
  constructor(
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
  ) { }

  async execute(
    input: ListTranscriptionsInputDto,
  ): Promise<ListTranscriptionsOutputDto> {
    const transcriptions = await this.youtubeTranscriptionsService.getAllTranscriptions();

    let filteredTranscriptions = transcriptions;

    if (input.channelId) {
      filteredTranscriptions = filteredTranscriptions.filter(
        (t) => t.channelId === input.channelId,
      );
    }

    if (input.channelName) {
      filteredTranscriptions = filteredTranscriptions.filter(
        (t) => t.channelName === input.channelName,
      );
    }

    const withSummary = filteredTranscriptions.filter(
      (t) => t.transcriptionSummary,
    ).length;

    const channelCounts = filteredTranscriptions.reduce(
      (acc, t) => {
        acc[t.channelName] = (acc[t.channelName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      transcriptions: filteredTranscriptions,
      statistics: {
        total: filteredTranscriptions.length,
        withSummary,
        withoutSummary: filteredTranscriptions.length - withSummary,
        channelCounts,
      },
    };
  }
}
