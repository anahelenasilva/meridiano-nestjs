/**
 * E2E for the transcriptions list HTTP contract after the channels FK refactor.
 *
 * Asserts the response still carries `channelId`/`channelName` per transcription
 * and that split channels surface as a single consolidated group. The raw SQL
 * consolidation (DISTINCT over the internal id + join) is exercised by the
 * migration and the `resolveChannelIds` unit test; here the service is mocked to
 * return the post-backfill shape, so this pins the boundary contract the
 * frontend depends on.
 */
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { AudioJobService } from '@libs/audio';
import { AudioFilesService } from '../src/audio-files/audio-files.service';
import { NotesReadService } from '../src/notes/notes-read.service';
import { CreateYoutubeTranscriptionCommand } from '../src/youtube-transcriptions/commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from '../src/youtube-transcriptions/commands/delete-youtube-transcription.command';
import { DBYoutubeTranscription } from '../src/youtube-transcriptions/entities/youtube-transcription.entity';
import { GetYoutubeTranscriptionByIdQuery } from '../src/youtube-transcriptions/queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from '../src/youtube-transcriptions/queries/list-all-youtube-transcriptions.query';
import { YoutubeTranscriptionsService } from '../src/youtube-transcriptions/services/youtube-transcriptions.service';
import { YoutubeTranscriptionsController } from '../src/youtube-transcriptions/youtube-transcriptions.controller';

describe('YouTube Transcriptions list (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockService: MockProxy<YoutubeTranscriptionsService>;
  let mockNotesReadService: MockProxy<NotesReadService>;

  const augustoInternalId = '11111111-1111-1111-1111-111111111111';

  function buildTranscription(
    overrides: Partial<DBYoutubeTranscription> = {},
  ): DBYoutubeTranscription {
    return {
      id: 'transcription-1',
      channelId: augustoInternalId,
      channelName: 'Augusto Galego',
      videoTitle: 'Video A',
      videoUrl: 'https://youtube.com/watch?v=a',
      processedAt: new Date('2026-01-01T00:00:00.000Z'),
      transcriptionText: 'Text A',
      ...overrides,
    };
  }

  beforeAll(async () => {
    mockService = mock<YoutubeTranscriptionsService>();
    mockNotesReadService = mock<NotesReadService>();

    moduleFixture = await Test.createTestingModule({
      controllers: [YoutubeTranscriptionsController],
      providers: [
        ListAllYoutubeTranscriptionsQuery,
        { provide: YoutubeTranscriptionsService, useValue: mockService },
        { provide: NotesReadService, useValue: mockNotesReadService },
        { provide: GetYoutubeTranscriptionByIdQuery, useValue: mock() },
        { provide: DeleteYoutubeTranscriptionCommand, useValue: mock() },
        { provide: CreateYoutubeTranscriptionCommand, useValue: mock() },
        { provide: AudioJobService, useValue: mock() },
        { provide: AudioFilesService, useValue: mock() },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              context.switchToHttp().getRequest().user = { id: 'user-1' };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('returns channelId and channelName per transcription', async () => {
    mockService.getAllTranscriptions.mockResolvedValue([buildTranscription()]);
    mockService.getDistinctChannels.mockResolvedValue([
      { id: augustoInternalId, name: 'Augusto Galego' },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/youtube/transcriptions')
      .expect(200);

    expect(response.body.transcriptions[0]).toMatchObject({
      channelId: augustoInternalId,
      channelName: 'Augusto Galego',
    });
  });

  it('consolidates a split channel into a single group keyed by channel identity', async () => {
    // Post-backfill: both videos of the previously split "Augusto Galego"
    // channel now resolve to the same internal id.
    mockService.getAllTranscriptions.mockResolvedValue([
      buildTranscription({
        id: 'transcription-1',
        videoTitle: 'From UUID row',
      }),
      buildTranscription({
        id: 'transcription-2',
        videoTitle: 'From external-id row',
        videoUrl: 'https://youtube.com/watch?v=b',
      }),
    ]);
    mockService.getDistinctChannels.mockResolvedValue([
      { id: augustoInternalId, name: 'Augusto Galego' },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/youtube/transcriptions')
      .expect(200);

    const channelIds = new Set(
      response.body.transcriptions.map(
        (transcription: { channelId: string }) => transcription.channelId,
      ),
    );
    expect(channelIds).toEqual(new Set([augustoInternalId]));
    expect(response.body.available_channels).toEqual([
      { id: augustoInternalId, name: 'Augusto Galego' },
    ]);
  });
});
