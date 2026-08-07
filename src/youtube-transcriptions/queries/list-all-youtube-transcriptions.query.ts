import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { DBYoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

/**
 * Omits the heavy free-text fields — those are only returned by the detail
 * endpoint (`GET /api/youtube/transcriptions/:id`), keeping the list light.
 */
export type YoutubeTranscriptionListItem = Omit<
  DBYoutubeTranscription,
  'transcriptionText' | 'transcriptionSummary'
>;

export type ListAllYoutubeTranscriptionsResponse = {
  transcriptions: WithNote<YoutubeTranscriptionListItem>[];
  available_channels: { id: string; name: string }[];
};

@Injectable()
export class ListAllYoutubeTranscriptionsQuery {
  constructor(
    private readonly service: YoutubeTranscriptionsService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    userId: string,
  ): Promise<ListAllYoutubeTranscriptionsResponse | null> {
    const transcriptions = await this.service.getAllTranscriptions();
    const availableChannels = await this.service.getDistinctChannels();

    const listItems: YoutubeTranscriptionListItem[] = transcriptions.map(
      ({ transcriptionText: _text, transcriptionSummary: _summary, ...rest }) =>
        rest,
    );

    // Bulk-resolve the owner's active notes in a single query and attach them,
    // avoiding an N+1 lookup while preserving the unpaginated list behavior.
    const notesBySourceId =
      await this.notesReadService.getActiveNotesBySourceIds(
        userId,
        'transcription',
        transcriptions.map((transcription) => transcription.id),
      );

    return {
      transcriptions: attachNotes(
        listItems,
        (transcription) => transcription.id,
        notesBySourceId,
      ),
      available_channels: availableChannels,
    };
  }
}
