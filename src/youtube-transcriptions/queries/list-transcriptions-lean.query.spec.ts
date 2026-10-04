import { mock } from 'jest-mock-extended';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import {
  LeanTranscriptionListRow,
  YoutubeTranscriptionsService,
} from '../services/youtube-transcriptions.service';
import { ListTranscriptionsLeanQuery } from './list-transcriptions-lean.query';

describe('ListTranscriptionsLeanQuery', () => {
  const mockService = mock<YoutubeTranscriptionsService>();
  const mockNotesReadService = mock<NotesReadService>();

  const userId = 'user-1';
  const transcriptionA: LeanTranscriptionListRow = {
    id: '11111111-1111-1111-1111-111111111111',
    channelId: '33333333-3333-3333-3333-333333333333',
    channelName: 'Channel A',
    channelExternalId: 'UC-channel-a',
    videoTitle: 'Video A',
    postedAt: new Date('2026-03-10T12:00:00.000Z'),
    videoUrl: 'https://youtube.com/watch?v=a',
    processedAt: new Date('2026-03-11T00:00:00.000Z'),
    transcriptionSummary: 'Summary A',
    custom_prompt: null,
    has_audio: true,
  };
  const transcriptionB: LeanTranscriptionListRow = {
    ...transcriptionA,
    id: '22222222-2222-2222-2222-222222222222',
    videoTitle: 'Video B',
    has_audio: false,
  };

  let query: ListTranscriptionsLeanQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());

    query = new ListTranscriptionsLeanQuery(mockService, mockNotesReadService);
  });

  it('embeds each owner active note via a single bulk lookup', async () => {
    mockService.listTranscriptions.mockResolvedValue({
      transcriptions: [transcriptionA, transcriptionB],
      total: 2,
    });
    const noteA: Note = {
      id: 'note-a',
      user_id: userId,
      source_type: 'transcription',
      source_id: transcriptionA.id,
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    };
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(
      new Map([[transcriptionA.id, noteA]]),
    );

    const result = await query.execute(userId, {});

    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledTimes(1);
    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
      userId,
      'transcription',
      [transcriptionA.id, transcriptionB.id],
    );
    expect(result.transcriptions[0].note).toEqual({
      id: 'note-a',
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    expect(result.transcriptions[1].note).toBeNull();
  });

  it('skips the note lookup and returns null notes on the api-key path (no user)', async () => {
    mockService.listTranscriptions.mockResolvedValue({
      transcriptions: [transcriptionA, transcriptionB],
      total: 2,
    });

    const result = await query.execute(undefined, {});

    expect(mockNotesReadService.getActiveNotesBySourceIds).not.toHaveBeenCalled();
    expect(result.transcriptions.map((transcription) => transcription.note)).toEqual([
      null,
      null,
    ]);
  });

  it('defaults to page 1 of 20 and echoes empty filters', async () => {
    mockService.listTranscriptions.mockResolvedValue({ transcriptions: [], total: 0 });

    const result = await query.execute(userId, {});

    expect(mockService.listTranscriptions).toHaveBeenCalledWith(
      { channelId: undefined, startDate: undefined, endDate: undefined },
      { page: 1, perPage: 20 },
    );
    expect(result.pagination).toEqual({
      page: 1,
      per_page: 20,
      total_pages: 0,
      total_transcriptions: 0,
    });
    expect(result.filters).toEqual({ channel_id: '', start_date: '', end_date: '' });
  });

  it('passes the filter and page through and reports the page count', async () => {
    mockService.listTranscriptions.mockResolvedValue({
      transcriptions: [transcriptionA, transcriptionB],
      total: 5,
    });

    const result = await query.execute(userId, {
      page: 2,
      perPage: 2,
      channelId: 'UC-channel-a',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(mockService.listTranscriptions).toHaveBeenCalledWith(
      { channelId: 'UC-channel-a', startDate: '2026-03-01', endDate: '2026-03-31' },
      { page: 2, perPage: 2 },
    );
    expect(result.pagination).toEqual({
      page: 2,
      per_page: 2,
      total_pages: 3,
      total_transcriptions: 5,
    });
    expect(result.filters).toEqual({
      channel_id: 'UC-channel-a',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    });
  });
});
