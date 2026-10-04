import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ListTranscriptionsLeanRequest } from '../dto/list-transcriptions-lean.dto';
import {
  YoutubeTranscriptionListRow,
  YoutubeTranscriptionsService,
} from '../services/youtube-transcriptions.service';

// Drops the full transcript text, the heaviest field by far, and the
// thumbnail a terminal cannot show. The AI summary stays.
type LeanTranscription = Omit<
  YoutubeTranscriptionListRow,
  'transcriptionText' | 'thumbnailUrl'
>;

export type ListTranscriptionsLeanResponse = {
  transcriptions: WithNote<LeanTranscription>[];
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

function toLeanTranscription({
  transcriptionText: _text,
  thumbnailUrl: _thumbnail,
  ...lean
}: YoutubeTranscriptionListRow): LeanTranscription {
  return lean;
}

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
    // Undefined on the api-key path (CLI/ops), which has no user. Notes are the
    // only user-scoped part of the response, so a missing user just means none.
    userId: string | undefined,
    request: ListTranscriptionsLeanRequest,
  ): Promise<ListTranscriptionsLeanResponse> {
    const { page = 1, perPage = 20, channelId, startDate, endDate } = request;

    const { transcriptions: rows, total } =
      await this.service.listTranscriptions(
        { channelId, startDate, endDate },
        { page, perPage },
      );
    const leanTranscriptions = rows.map(toLeanTranscription);

    const notesBySourceId = userId
      ? await this.notesReadService.getActiveNotesBySourceIds(
          userId,
          'transcription',
          leanTranscriptions.map((transcription) => transcription.id),
        )
      : new Map<string, Note>();

    return {
      transcriptions: attachNotes(
        leanTranscriptions,
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
