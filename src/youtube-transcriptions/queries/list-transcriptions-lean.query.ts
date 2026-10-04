import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ListTranscriptionsLeanRequest } from '../dto/list-transcriptions-lean.dto';
import {
  LeanTranscriptionListRow,
  YoutubeTranscriptionsService,
} from '../services/youtube-transcriptions.service';

export type ListTranscriptionsLeanResponse = {
  transcriptions: WithNote<LeanTranscriptionListRow>[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_transcriptions: number;
  };
  filters: {
    channel_id: string;
    start_date: string;
    end_date: string;
  };
};

/**
 * Backs GET /api/youtube/transcriptions/lean, the paginated list the CLI
 * reads. Unlike ListAllYoutubeTranscriptionsQuery it pages, filters, and
 * skips the frontend's available_channels lookup.
 */
@Injectable()
export class ListTranscriptionsLeanQuery {
  constructor(
    private readonly service: YoutubeTranscriptionsService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    // Undefined on the api-key path, which has no user, so no notes attach.
    userId: string | undefined,
    request: ListTranscriptionsLeanRequest,
  ): Promise<ListTranscriptionsLeanResponse> {
    const { page = 1, perPage = 20, channelId, startDate, endDate } = request;

    const { transcriptions, total } = await this.service.listTranscriptions(
      { channelId, startDate, endDate },
      { page, perPage },
    );

    const notesBySourceId = userId
      ? await this.notesReadService.getActiveNotesBySourceIds(
          userId,
          'transcription',
          transcriptions.map((transcription) => transcription.id),
        )
      : new Map<string, Note>();

    return {
      transcriptions: attachNotes(
        transcriptions,
        (transcription) => transcription.id,
        notesBySourceId,
      ),
      pagination: {
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
        total_transcriptions: total,
      },
      filters: {
        channel_id: channelId ?? '',
        start_date: startDate ?? '',
        end_date: endDate ?? '',
      },
    };
  }
}
