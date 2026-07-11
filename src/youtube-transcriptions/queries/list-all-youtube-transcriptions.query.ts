import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { DBYoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type ListAllYoutubeTranscriptionsResponse = {
  transcriptions: WithNote<DBYoutubeTranscription>[];
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
        transcriptions,
        (transcription) => transcription.id,
        notesBySourceId,
      ),
      available_channels: availableChannels,
    };
  }
}
