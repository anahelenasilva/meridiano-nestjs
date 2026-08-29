/**
 * E2E for the transcriptions list HTTP contract after the channels FK refactor.
 *
 * The raw SQL consolidation (DISTINCT over the internal id + join) lives in the
 * service and cannot be exercised without a database, so it is covered by the
 * `resolveChannelIds` unit test and the migration. These tests mock the service
 * at its post-backfill shape and assert only the controller boundary contract:
 * that the endpoint faithfully surfaces `channelId`/`channelName` and the merged
 * `available_channels` the service returns, without regrouping or reshaping them.
 *
 * The category-editing tests (issue #209) additionally wire in the real
 * YouTube channels controller/command so a PUT against the assignment endpoint
 * and a subsequent GET against the transcriptions list share the same
 * ChannelCategoriesService mock, proving an edit is reflected on the list.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { AudioJobService } from '@libs/audio';
import { AudioFilesService } from '../src/audio-files/audio-files.service';
import { CATEGORY_COLORS } from '../src/categories/category-colors';
import { FindOrCreateCategoriesCommand } from '../src/categories/commands/find-or-create-categories.command';
import { Category } from '../src/categories/domain/category';
import { NotesReadService } from '../src/notes/notes-read.service';
import { ChannelCategoriesService } from '../src/youtube-channels/channel-categories.service';
import { AssignChannelCategoriesCommand } from '../src/youtube-channels/commands/assign-channel-categories.command';
import { CreateYoutubeChannelCommand } from '../src/youtube-channels/commands/create-youtube-channel.command';
import { UpdateChannelEnabledCommand } from '../src/youtube-channels/commands/update-channel-enabled.command';
import { YoutubeChannel } from '../src/youtube-channels/domain/youtube-channel';
import { GetYoutubeChannelsQuery } from '../src/youtube-channels/queries/get-youtube-channels.query';
import { YoutubeChannelsController } from '../src/youtube-channels/youtube-channels.controller';
import { YoutubeChannelsService } from '../src/youtube-channels/youtube-channels.service';
import { DeleteYoutubeTranscriptionCommand } from '../src/youtube-transcriptions/commands/delete-youtube-transcription.command';
import { DismissIngestJobCommand } from '../src/youtube-transcriptions/commands/dismiss-ingest-job.command';
import { EnqueueYoutubeTranscriptionsCommand } from '../src/youtube-transcriptions/commands/enqueue-youtube-transcriptions.command';
import { GetYoutubeTranscriptionByIdQuery } from '../src/youtube-transcriptions/queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from '../src/youtube-transcriptions/queries/list-all-youtube-transcriptions.query';
import { ListFailedIngestJobsQuery } from '../src/youtube-transcriptions/queries/list-failed-ingest-jobs.query';
import {
  YoutubeTranscriptionListRow,
  YoutubeTranscriptionsService,
} from '../src/youtube-transcriptions/services/youtube-transcriptions.service';
import { YoutubeTranscriptionsController } from '../src/youtube-transcriptions/youtube-transcriptions.controller';

describe('YouTube Transcriptions list (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockService: MockProxy<YoutubeTranscriptionsService>;
  let mockNotesReadService: MockProxy<NotesReadService>;
  let channelCategoriesService: MockProxy<ChannelCategoriesService>;
  let youtubeChannelsService: MockProxy<YoutubeChannelsService>;
  let findOrCreateCategoriesCommand: MockProxy<FindOrCreateCategoriesCommand>;
  let enqueueTranscriptionsCommand: MockProxy<EnqueueYoutubeTranscriptionsCommand>;
  let listFailedIngestJobsQuery: MockProxy<ListFailedIngestJobsQuery>;
  let dismissIngestJobCommand: MockProxy<DismissIngestJobCommand>;

  const augustoInternalId = '11111111-1111-1111-1111-111111111111';

  function buildCategory(overrides: Partial<Category> = {}): Category {
    return {
      id: 'category-1',
      name: 'tech',
      color: CATEGORY_COLORS.blue,
      createdAt: new Date('2026-08-16T12:00:00.000Z'),
      updatedAt: new Date('2026-08-16T12:00:00.000Z'),
      ...overrides,
    };
  }

  function buildChannel(overrides: Partial<YoutubeChannel> = {}): YoutubeChannel {
    return {
      id: augustoInternalId,
      channelId: 'UCLW51-XEzuOm5RwPMChHBMw',
      name: 'Augusto Galego',
      url: 'https://www.youtube.com/@augustogalego',
      description: 'Tech channel',
      enabled: true,
      maxVideos: null,
      createdAt: new Date('2026-08-16T12:00:00.000Z'),
      updatedAt: new Date('2026-08-16T12:00:00.000Z'),
      ...overrides,
    };
  }

  function buildTranscription(
    overrides: Partial<YoutubeTranscriptionListRow> = {},
  ): YoutubeTranscriptionListRow {
    return {
      id: 'transcription-1',
      channelId: augustoInternalId,
      channelName: 'Augusto Galego',
      channelExternalId: 'UCLW51-XEzuOm5RwPMChHBMw',
      videoTitle: 'Video A',
      videoUrl: 'https://youtube.com/watch?v=a',
      processedAt: new Date('2026-01-01T00:00:00.000Z'),
      transcriptionText: 'Text A',
      has_audio: false,
      ...overrides,
    };
  }

  beforeAll(async () => {
    mockService = mock<YoutubeTranscriptionsService>();
    mockNotesReadService = mock<NotesReadService>();
    channelCategoriesService = mock<ChannelCategoriesService>();
    youtubeChannelsService = mock<YoutubeChannelsService>();
    findOrCreateCategoriesCommand = mock<FindOrCreateCategoriesCommand>();
    enqueueTranscriptionsCommand = mock<EnqueueYoutubeTranscriptionsCommand>();
    listFailedIngestJobsQuery = mock<ListFailedIngestJobsQuery>();
    dismissIngestJobCommand = mock<DismissIngestJobCommand>();

    moduleFixture = await Test.createTestingModule({
      controllers: [YoutubeTranscriptionsController, YoutubeChannelsController],
      providers: [
        ListAllYoutubeTranscriptionsQuery,
        AssignChannelCategoriesCommand,
        { provide: GetYoutubeChannelsQuery, useValue: mock() },
        { provide: UpdateChannelEnabledCommand, useValue: mock() },
        { provide: CreateYoutubeChannelCommand, useValue: mock() },
        { provide: YoutubeTranscriptionsService, useValue: mockService },
        { provide: NotesReadService, useValue: mockNotesReadService },
        {
          provide: ChannelCategoriesService,
          useValue: channelCategoriesService,
        },
        { provide: YoutubeChannelsService, useValue: youtubeChannelsService },
        {
          provide: FindOrCreateCategoriesCommand,
          useValue: findOrCreateCategoriesCommand,
        },
        { provide: GetYoutubeTranscriptionByIdQuery, useValue: mock() },
        { provide: DeleteYoutubeTranscriptionCommand, useValue: mock() },
        {
          provide: EnqueueYoutubeTranscriptionsCommand,
          useValue: enqueueTranscriptionsCommand,
        },
        { provide: ListFailedIngestJobsQuery, useValue: listFailedIngestJobsQuery },
        { provide: DismissIngestJobCommand, useValue: dismissIngestJobCommand },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());
    channelCategoriesService.getCategoriesForChannels.mockResolvedValue(
      new Map(),
    );
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('surfaces channelId, channelName and the joined external id per transcription', async () => {
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
      channelExternalId: 'UCLW51-XEzuOm5RwPMChHBMw',
    });
  });

  it('surfaces a single channelId and available_channels entry when the service reports a consolidated channel', async () => {
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
      { id: augustoInternalId, name: 'Augusto Galego', categories: [] },
    ]);
  });

  it('surfaces each channel\'s categories in available_channels', async () => {
    const tech = buildCategory({ id: 'category-1', name: 'tech' });

    mockService.getAllTranscriptions.mockResolvedValue([buildTranscription()]);
    mockService.getDistinctChannels.mockResolvedValue([
      { id: augustoInternalId, name: 'Augusto Galego' },
    ]);
    channelCategoriesService.getCategoriesForChannels.mockResolvedValue(
      new Map([[augustoInternalId, [tech]]]),
    );

    const response = await request(app.getHttpServer())
      .get('/api/youtube/transcriptions')
      .expect(200);

    expect(response.body.available_channels).toEqual([
      {
        id: augustoInternalId,
        name: 'Augusto Galego',
        categories: [
          { id: 'category-1', name: 'tech', color: CATEGORY_COLORS.blue },
        ],
      },
    ]);
  });

  it('reflects a category edit made through the assignment endpoint on the transcriptions list', async () => {
    // In-memory store standing in for the channel_categories join table, shared
    // by both the PUT (write) and GET (read) mocks below.
    const categoriesByChannel = new Map<string, Category[]>();

    mockService.getAllTranscriptions.mockResolvedValue([buildTranscription()]);
    mockService.getDistinctChannels.mockResolvedValue([
      { id: augustoInternalId, name: 'Augusto Galego' },
    ]);
    channelCategoriesService.getCategoriesForChannels.mockImplementation(
      (channelIds) =>
        Promise.resolve(
          new Map(
            channelIds.map((id) => [id, categoriesByChannel.get(id) ?? []]),
          ),
        ),
    );

    const before = await request(app.getHttpServer())
      .get('/api/youtube/transcriptions')
      .expect(200);
    expect(before.body.available_channels[0].categories).toEqual([]);

    const tech = buildCategory({ id: 'category-1', name: 'tech' });
    youtubeChannelsService.getChannelById.mockResolvedValue(buildChannel());
    findOrCreateCategoriesCommand.execute.mockResolvedValue([tech]);
    channelCategoriesService.replaceChannelCategories.mockImplementation(
      (channelId, categoryIds) => {
        categoriesByChannel.set(
          channelId,
          categoryIds.map((id) => (id === tech.id ? tech : buildCategory({ id }))),
        );
        return Promise.resolve();
      },
    );
    channelCategoriesService.getCategoriesForChannel.mockImplementation(
      (channelId) => Promise.resolve(categoriesByChannel.get(channelId) ?? []),
    );

    await request(app.getHttpServer())
      .put(`/api/youtube/channels/${augustoInternalId}/categories`)
      .send({ categoryNames: ['tech'] })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/youtube/transcriptions')
      .expect(200);

    expect(after.body.available_channels).toEqual([
      {
        id: augustoInternalId,
        name: 'Augusto Galego',
        categories: [
          { id: 'category-1', name: 'tech', color: CATEGORY_COLORS.blue },
        ],
      },
    ]);
  });
  describe('bulk ingest routes', () => {
    it('accepts a batch of urls with 202 and reports the per-url outcome', async () => {
      enqueueTranscriptionsCommand.execute.mockResolvedValue({
        accepted: ['https://www.youtube.com/watch?v=abc123'],
        skipped: ['https://www.youtube.com/watch?v=dup456'],
        rejected: [{ url: 'not a url', reason: 'Not a recognizable YouTube video URL' }],
      });

      const response = await request(app.getHttpServer())
        .post('/api/youtube/transcriptions')
        .send({
          urls: [
            'https://www.youtube.com/watch?v=abc123',
            'https://www.youtube.com/watch?v=dup456',
            'not a url',
          ],
          channelId: augustoInternalId,
        })
        .expect(202);

      expect(response.body).toEqual({
        accepted: ['https://www.youtube.com/watch?v=abc123'],
        skipped: ['https://www.youtube.com/watch?v=dup456'],
        rejected: [{ url: 'not a url', reason: 'Not a recognizable YouTube video URL' }],
      });
    });

    it('returns the failed jobs under a jobs key', async () => {
      listFailedIngestJobsQuery.execute.mockResolvedValue([
        {
          jobId: `${augustoInternalId}:abc123`,
          videoUrl: 'https://www.youtube.com/watch?v=abc123',
          channelName: 'Augusto Galego',
          reason: 'Transcript unavailable',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/youtube/transcriptions/jobs/failed')
        .expect(200);

      expect(response.body).toEqual({
        jobs: [
          {
            jobId: `${augustoInternalId}:abc123`,
            videoUrl: 'https://www.youtube.com/watch?v=abc123',
            channelName: 'Augusto Galego',
            reason: 'Transcript unavailable',
          },
        ],
      });
    });

    // Pins the route declaration order: `transcriptions/jobs/:jobId` has to be
    // declared before `transcriptions/:id`, or the colon-bearing job id would
    // hit that route's ParseUUIDPipe and 400 instead of reaching the handler.
    it('routes a colon-bearing job id to the dismiss handler', async () => {
      const jobId = `${augustoInternalId}:abc123`;
      dismissIngestJobCommand.execute.mockResolvedValue({ dismissed: true });

      const response = await request(app.getHttpServer())
        .delete(`/api/youtube/transcriptions/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toEqual({ dismissed: true });
      expect(dismissIngestJobCommand.execute).toHaveBeenCalledWith(jobId);
    });
  });
});
