/**
 * E2E tests for assigning categories to YouTube channels (issue #208).
 *
 * Mirrors the categories.e2e-spec.ts convention: mock the raw-SQL service
 * classes (YoutubeChannelsService, CategoriesService, ChannelCategoriesService)
 * and exercise the real controllers/commands/queries on top of them.
 */
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { CATEGORY_COLORS } from '../src/categories/category-colors';
import { FindOrCreateCategoriesCommand } from '../src/categories/commands/find-or-create-categories.command';
import { Category } from '../src/categories/domain/category';
import { ChannelCategoriesService } from '../src/youtube-channels/channel-categories.service';
import { AssignChannelCategoriesCommand } from '../src/youtube-channels/commands/assign-channel-categories.command';
import { CreateYoutubeChannelCommand } from '../src/youtube-channels/commands/create-youtube-channel.command';
import { YoutubeChannel } from '../src/youtube-channels/domain/youtube-channel';
import { GetYoutubeChannelsQuery } from '../src/youtube-channels/queries/get-youtube-channels.query';
import { YoutubeChannelsController } from '../src/youtube-channels/youtube-channels.controller';
import { YoutubeChannelsService } from '../src/youtube-channels/youtube-channels.service';

describe('Youtube Channels categories (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let youtubeChannelsService: MockProxy<YoutubeChannelsService>;
  let categoriesService: MockProxy<CategoriesService>;
  let channelCategoriesService: MockProxy<ChannelCategoriesService>;

  function buildChannel(
    overrides: Partial<YoutubeChannel> = {},
  ): YoutubeChannel {
    return {
      id: 'channel-1',
      channelId: 'UC-external-1',
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

  beforeAll(async () => {
    youtubeChannelsService = mock<YoutubeChannelsService>();
    categoriesService = mock<CategoriesService>();
    channelCategoriesService = mock<ChannelCategoriesService>();

    moduleFixture = await Test.createTestingModule({
      controllers: [YoutubeChannelsController, CategoriesController],
      providers: [
        GetYoutubeChannelsQuery,
        CreateYoutubeChannelCommand,
        AssignChannelCategoriesCommand,
        FindOrCreateCategoriesCommand,
        { provide: YoutubeChannelsService, useValue: youtubeChannelsService },
        { provide: CategoriesService, useValue: categoriesService },
        {
          provide: ChannelCategoriesService,
          useValue: channelCategoriesService,
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
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  describe('PUT /api/youtube/channels/:channelId/categories', () => {
    it('replaces the channel category set with exactly the submitted categories', async () => {
      const tech = buildCategory({ id: 'category-1', name: 'tech' });
      const ai = buildCategory({
        id: 'category-2',
        name: 'AI',
        color: CATEGORY_COLORS.violet,
      });

      youtubeChannelsService.getChannelById.mockResolvedValue(buildChannel());
      categoriesService.getCategoryByName.mockImplementation((name) =>
        Promise.resolve(
          name.toLowerCase() === 'tech'
            ? tech
            : name.toLowerCase() === 'ai'
              ? ai
              : null,
        ),
      );
      channelCategoriesService.replaceChannelCategories.mockResolvedValue(
        undefined,
      );
      channelCategoriesService.getCategoriesForChannel.mockResolvedValue([
        tech,
        ai,
      ]);

      const response = await request(app.getHttpServer())
        .put('/api/youtube/channels/channel-1/categories')
        .send({ categoryNames: ['tech', 'AI'] })
        .expect(200);

      expect(response.body).toEqual([
        { id: 'category-1', name: 'tech', color: CATEGORY_COLORS.blue },
        { id: 'category-2', name: 'AI', color: CATEGORY_COLORS.violet },
      ]);
      expect(
        channelCategoriesService.replaceChannelCategories,
      ).toHaveBeenCalledWith('channel-1', ['category-1', 'category-2']);
    });

    it('creates a category inline when its name does not already exist', async () => {
      youtubeChannelsService.getChannelById.mockResolvedValue(buildChannel());
      categoriesService.getCategoryByName.mockResolvedValue(null);
      categoriesService.createCategory.mockImplementation((name) =>
        Promise.resolve(buildCategory({ id: 'new-category', name })),
      );
      channelCategoriesService.replaceChannelCategories.mockResolvedValue(
        undefined,
      );
      channelCategoriesService.getCategoriesForChannel.mockResolvedValue([
        buildCategory({ id: 'new-category', name: 'gaming' }),
      ]);

      const response = await request(app.getHttpServer())
        .put('/api/youtube/channels/channel-1/categories')
        .send({ categoryNames: ['gaming'] })
        .expect(200);

      expect(categoriesService.createCategory).toHaveBeenCalledWith('gaming');
      expect(
        channelCategoriesService.replaceChannelCategories,
      ).toHaveBeenCalledWith('channel-1', ['new-category']);
      expect(response.body).toEqual([
        {
          id: 'new-category',
          name: 'gaming',
          color: CATEGORY_COLORS.blue,
        },
      ]);
    });

    it('returns 404 when the channel does not exist', async () => {
      youtubeChannelsService.getChannelById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put('/api/youtube/channels/missing/categories')
        .send({ categoryNames: ['tech'] })
        .expect(404);

      expect(categoriesService.getCategoryByName).not.toHaveBeenCalled();
    });

    it('rejects a non-array categoryNames with 400', async () => {
      await request(app.getHttpServer())
        .put('/api/youtube/channels/channel-1/categories')
        .send({ categoryNames: 'tech' })
        .expect(400);
    });

    it('clears all categories when given an empty array', async () => {
      youtubeChannelsService.getChannelById.mockResolvedValue(buildChannel());
      channelCategoriesService.replaceChannelCategories.mockResolvedValue(
        undefined,
      );
      channelCategoriesService.getCategoriesForChannel.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .put('/api/youtube/channels/channel-1/categories')
        .send({ categoryNames: [] })
        .expect(200);

      expect(response.body).toEqual([]);
      expect(categoriesService.getCategoryByName).not.toHaveBeenCalled();
      expect(
        channelCategoriesService.replaceChannelCategories,
      ).toHaveBeenCalledWith('channel-1', []);
    });
  });

  describe('PATCH /api/youtube/channels/:channelId', () => {
    it.each([
      [true, 'Channel enabled successfully'],
      [false, 'Channel disabled successfully'],
    ])('sets enabled to %s', async (enabled, message) => {
      youtubeChannelsService.updateChannelEnabled.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .patch('/api/youtube/channels/channel-1')
        .send({ enabled })
        .expect(200);

      expect(response.body).toEqual({ success: true, message });
      expect(youtubeChannelsService.updateChannelEnabled).toHaveBeenCalledWith(
        'channel-1',
        enabled,
      );
    });

    it('returns 404 when the channel does not exist', async () => {
      youtubeChannelsService.updateChannelEnabled.mockRejectedValue(
        new NotFoundException('Channel with ID missing not found'),
      );

      await request(app.getHttpServer())
        .patch('/api/youtube/channels/missing')
        .send({ enabled: false })
        .expect(404);
    });
  });

  describe('POST /api/youtube/channels', () => {
    function validCreatePayload(overrides: Record<string, unknown> = {}) {
      return {
        channelId: 'UC-external-2',
        name: 'Away Together',
        url: 'https://www.youtube.com/@awaytogether',
        description: 'Travel channel',
        enabled: true,
        ...overrides,
      };
    }

    it('creates a channel and assigns the requested categories, creating unknown ones inline', async () => {
      const travel = buildCategory({
        id: 'category-travel',
        name: 'travel',
        color: CATEGORY_COLORS.emerald,
      });

      youtubeChannelsService.createChannel.mockResolvedValue(
        buildChannel({
          id: 'channel-2',
          channelId: 'UC-external-2',
          name: 'Away Together',
        }),
      );
      youtubeChannelsService.getChannelById.mockResolvedValue(
        buildChannel({
          id: 'channel-2',
          channelId: 'UC-external-2',
          name: 'Away Together',
        }),
      );
      categoriesService.getCategoryByName.mockImplementation((name) =>
        Promise.resolve(name.toLowerCase() === 'travel' ? travel : null),
      );
      categoriesService.createCategory.mockImplementation((name) =>
        Promise.resolve(buildCategory({ id: 'category-new', name })),
      );
      channelCategoriesService.replaceChannelCategories.mockResolvedValue(
        undefined,
      );
      channelCategoriesService.getCategoriesForChannel.mockResolvedValue([
        travel,
        buildCategory({ id: 'category-new', name: 'vlog' }),
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/youtube/channels')
        .send(validCreatePayload({ categoryNames: ['travel', 'vlog'] }))
        .expect(201);

      expect(response.body.categories).toEqual([
        {
          id: 'category-travel',
          name: 'travel',
          color: CATEGORY_COLORS.emerald,
        },
        { id: 'category-new', name: 'vlog', color: CATEGORY_COLORS.blue },
      ]);
      expect(categoriesService.createCategory).toHaveBeenCalledWith('vlog');
    });

    it('creates a channel with no categories when none are given', async () => {
      youtubeChannelsService.createChannel.mockResolvedValue(
        buildChannel({
          id: 'channel-3',
          channelId: 'UC-external-3',
        }),
      );

      const response = await request(app.getHttpServer())
        .post('/api/youtube/channels')
        .send(validCreatePayload({ channelId: 'UC-external-3' }))
        .expect(201);

      expect(response.body.categories).toEqual([]);
      expect(
        channelCategoriesService.replaceChannelCategories,
      ).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/youtube/channels', () => {
    it('returns each channel with its categories', async () => {
      const channelWithCategories = buildChannel({ id: 'channel-1' });
      const channelWithoutCategories = buildChannel({
        id: 'channel-2',
        channelId: 'UC-external-2',
        name: 'PewDiePie',
      });
      const tech = buildCategory({ id: 'category-1', name: 'tech' });

      youtubeChannelsService.getAllChannels.mockResolvedValue([
        channelWithCategories,
        channelWithoutCategories,
      ]);
      channelCategoriesService.getCategoriesForChannels.mockResolvedValue(
        new Map([['channel-1', [tech]]]),
      );

      const response = await request(app.getHttpServer())
        .get('/api/youtube/channels')
        .expect(200);

      expect(
        channelCategoriesService.getCategoriesForChannels,
      ).toHaveBeenCalledWith(['channel-1', 'channel-2']);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: 'channel-1',
          categories: [
            { id: 'category-1', name: 'tech', color: CATEGORY_COLORS.blue },
          ],
        }),
        expect.objectContaining({ id: 'channel-2', categories: [] }),
      ]);
    });
  });
});
