import { mock } from 'jest-mock-extended';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ChannelCategoriesService } from '../../youtube-channels/channel-categories.service';
import { DBYoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';
import { ListAllYoutubeTranscriptionsQuery } from './list-all-youtube-transcriptions.query';

describe('ListAllYoutubeTranscriptionsQuery', () => {
  const mockService = mock<YoutubeTranscriptionsService>();
  const mockNotesReadService = mock<NotesReadService>();
  const mockChannelCategoriesService = mock<ChannelCategoriesService>();

  const userId = 'user-1';
  const transcriptionA: DBYoutubeTranscription = {
    id: '11111111-1111-1111-1111-111111111111',
    channelId: 'channel-1',
    channelName: 'Channel One',
    channelExternalId: 'UC-channel-1-external',
    videoTitle: 'Video A',
    videoUrl: 'https://youtube.com/watch?v=a',
    processedAt: new Date('2024-01-01'),
    transcriptionText: 'Text A',
  };
  const transcriptionB: DBYoutubeTranscription = {
    id: '22222222-2222-2222-2222-222222222222',
    channelId: 'channel-1',
    channelName: 'Channel One',
    channelExternalId: 'UC-channel-1-external',
    videoTitle: 'Video B',
    videoUrl: 'https://youtube.com/watch?v=b',
    processedAt: new Date('2024-01-02'),
    transcriptionText: 'Text B',
  };
  const availableChannels = [{ id: 'channel-1', name: 'Channel One' }];

  let query: ListAllYoutubeTranscriptionsQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.getDistinctChannels.mockResolvedValue(availableChannels);
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());
    mockChannelCategoriesService.getCategoriesForChannels.mockResolvedValue(
      new Map(),
    );
    query = new ListAllYoutubeTranscriptionsQuery(
      mockService,
      mockNotesReadService,
      mockChannelCategoriesService,
    );
  });

  it('embeds each owner active note via a single bulk lookup', async () => {
    mockService.getAllTranscriptions.mockResolvedValue([
      transcriptionA,
      transcriptionB,
    ]);
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

    const result = await query.execute(userId);

    // Single bulk lookup for the whole page — no per-item (N+1) fetch.
    expect(
      mockNotesReadService.getActiveNotesBySourceIds,
    ).toHaveBeenCalledTimes(1);
    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
      userId,
      'transcription',
      [transcriptionA.id, transcriptionB.id],
    );

    expect(result?.transcriptions).toHaveLength(2);
    expect(result?.transcriptions[0].note).toEqual({
      id: 'note-a',
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    // Items without an active note get note: null.
    expect(result?.transcriptions[1].note).toBeNull();
    // Heavy free-text fields are excluded from the list payload; they are only
    // returned by the detail endpoint.
    expect(result?.transcriptions[0]).not.toHaveProperty('transcriptionText');
    expect(result?.transcriptions[0]).not.toHaveProperty(
      'transcriptionSummary',
    );
    // Embedded shape must not leak ownership internals.
    expect(result?.transcriptions[0].note).not.toHaveProperty('user_id');
    expect(result?.transcriptions[0].note).not.toHaveProperty('source_id');
    expect(result?.transcriptions[0].note).not.toHaveProperty('source_type');
    expect(result?.available_channels).toEqual([
      { ...availableChannels[0], categories: [] },
    ]);
  });

  it("attaches each channel's categories to available_channels", async () => {
    mockService.getAllTranscriptions.mockResolvedValue([
      transcriptionA,
      transcriptionB,
    ]);
    mockChannelCategoriesService.getCategoriesForChannels.mockResolvedValue(
      new Map([
        [
          'channel-1',
          [
            {
              id: 'category-1',
              name: 'tech',
              color: '#000000',
              createdAt: new Date('2026-01-01'),
              updatedAt: new Date('2026-01-01'),
            },
          ],
        ],
      ]),
    );

    const result = await query.execute(userId);

    expect(
      mockChannelCategoriesService.getCategoriesForChannels,
    ).toHaveBeenCalledWith(['channel-1']);
    expect(result?.available_channels).toEqual([
      {
        id: 'channel-1',
        name: 'Channel One',
        categories: [{ id: 'category-1', name: 'tech', color: '#000000' }],
      },
    ]);
  });

  it('sets note to null for every item when no active notes exist', async () => {
    mockService.getAllTranscriptions.mockResolvedValue([
      transcriptionA,
      transcriptionB,
    ]);
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());

    const result = await query.execute(userId);

    expect(result?.transcriptions.map((t) => t.note)).toEqual([null, null]);
  });

  it('returns an empty list without leaving notes unresolved', async () => {
    mockService.getAllTranscriptions.mockResolvedValue([]);

    const result = await query.execute(userId);

    expect(result?.transcriptions).toEqual([]);
    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
      userId,
      'transcription',
      [],
    );
  });
});
