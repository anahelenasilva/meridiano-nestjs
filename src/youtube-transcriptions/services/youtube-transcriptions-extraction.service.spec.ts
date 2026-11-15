import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockReset } from 'jest-mock-extended';

import { DatabaseService } from '@libs/database';
import { QueueService } from '@libs/queue/queue.service';
import { INestApplication } from '@nestjs/common';
import { ChannelConfig } from '../../shared/types/channel';
import { VideoMetadata } from '../../shared/types/video';
import { YoutubeChannel } from '../../youtube-channels/domain/youtube-channel';
import { YoutubeChannelsService } from '../../youtube-channels/youtube-channels.service';
import { StorageService } from './storage.service';
import { TranscriptFetcherService } from './transcript-fetcher.service';
import { YoutubeTranscriptionsExtractionService } from './youtube-transcriptions-extraction.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

describe('YoutubeTranscriptionsExtractionService', () => {
  let service: YoutubeTranscriptionsExtractionService;
  let app: INestApplication;

  // Mock implementations
  const mockYouTubeService = mock<YouTubeService>();
  const mockTranscriptFetcher = mock<TranscriptFetcherService>();
  const mockStorageService = mock<StorageService>();
  const mockDatabaseService = mock<DatabaseService>();
  const mockQueueService = mock<QueueService>();
  const mockYoutubeChannelsService = mock<YoutubeChannelsService>();
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeTranscriptionsExtractionService,
        {
          provide: YouTubeService,
          useValue: mockYouTubeService,
        },
        {
          provide: TranscriptFetcherService,
          useValue: mockTranscriptFetcher,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: YoutubeChannelsService,
          useValue: mockYoutubeChannelsService,
        },
        {
          provide: YoutubeTranscriptionsService,
          useValue: mockYoutubeTranscriptionsService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    service = module.get<YoutubeTranscriptionsExtractionService>(
      YoutubeTranscriptionsExtractionService,
    );
  });

  beforeEach(() => {
    mockReset(mockYouTubeService);
    mockReset(mockTranscriptFetcher);
    mockReset(mockStorageService);
    mockReset(mockDatabaseService);
    mockReset(mockQueueService);
    mockReset(mockYoutubeChannelsService);
    mockReset(mockYoutubeTranscriptionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('extractChannelTranscripts', () => {
    it('should extract transcripts from a channel successfully', async () => {
      // Arrange
      const mockChannel: YoutubeChannel = {
        id: '123',
        channelId: 'UC123',
        name: 'Test Channel',
        description: 'Test Description',
        maxVideos: 2,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://youtube.com/channel/UC123',
      };

      const mockChannelConfig: ChannelConfig = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
        databaseId: '123',
      };

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video2',
          title: 'Video 2',
          url: 'https://youtube.com/watch?v=video2',
          publishedAt: '2025-01-02',
        },
      ];

      const mockTranscript = [
        { text: 'Hello', duration: 1000, offset: 0 },
        { text: 'World', duration: 1000, offset: 1000 },
      ];

      mockYouTubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockTranscriptFetcher.fetch.mockResolvedValue({
        method: 'alternative',
        transcript: mockTranscript,
        transcriptText: 'Hello World',
      });
      mockStorageService.saveTranscript.mockResolvedValue(undefined);
      mockYoutubeChannelsService.getChannelById.mockResolvedValue(mockChannel);

      // Act
      await service.extractChannelTranscripts(mockChannelConfig);

      // Assert
      expect(mockYouTubeService.getChannelVideos).toHaveBeenNthCalledWith(
        1,
        mockChannelConfig,
      );
      expect(mockTranscriptFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no transcripts are successfully extracted', async () => {
      // Arrange
      const mockChannelConfig: ChannelConfig = {
        channelId: 'UC123',
        databaseId: '123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
      };

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
      ];

      mockYouTubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockTranscriptFetcher.fetch.mockRejectedValue(
        new Error('Transcript not available'),
      );

      // Act & Assert
      await expect(
        service.extractChannelTranscripts(mockChannelConfig),
      ).rejects.toThrow(
        'Failed to extract any transcripts from channel Test Channel',
      );
    });

    it('should continue processing when some videos fail', async () => {
      // Arrange
      const mockChannelConfig: ChannelConfig = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
        databaseId: '123',
      };

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video`2',
          title: 'Video 2',
          url: 'https://youtube.com/watch?v=video2',
          publishedAt: '2025-01-02',
        },
      ];

      const mockTranscript = [{ text: 'Hello', duration: 1000, offset: 0 }];

      mockYouTubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockTranscriptFetcher.fetch
        .mockRejectedValueOnce(new Error('Transcript not available'))
        .mockResolvedValueOnce({
          method: 'alternative',
          transcript: mockTranscript,
          transcriptText: 'Hello',
        });
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      await service.extractChannelTranscripts(mockChannelConfig);

      // Assert
      expect(mockTranscriptFetcher.fetch).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractAll', () => {
    it('should extract transcripts from all channels', async () => {
      // Arrange
      const mockChannels = [
        {
          channelId: 'UC123',
          databaseId: '123',
          channelName: 'Channel 1',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
        {
          channelId: 'UC456',
          databaseId: '456',
          channelName: 'Channel 2',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
      ];

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
            databaseId: '123',
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
      ];

      const mockTranscript = [{ text: 'Hello', duration: 1000, offset: 0 }];

      mockYouTubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockTranscriptFetcher.fetch.mockResolvedValue({
        method: 'alternative',
        transcript: mockTranscript,
        transcriptText: 'Hello',
      });
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      const result = await service.extractAll(mockChannels);

      // Assert
      expect(result).toEqual({ succeeded: 2, failed: 0 });
      expect(mockYouTubeService.getChannelVideos).toHaveBeenCalledTimes(2);
    });

    it('should continue when some channels fail', async () => {
      // Arrange
      const mockChannels: ChannelConfig[] = [
        {
          channelId: 'UC123',
          databaseId: '123',
          channelName: 'Channel 1',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
        {
          channelId: 'UC456',
          databaseId: '456',
          channelName: 'Channel 2',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
      ];

      mockYouTubeService.getChannelVideos
        .mockRejectedValueOnce(new Error('Channel not found'))
        .mockResolvedValueOnce([
          {
            channel: {
              id: 'UC123',
              databaseId: '123',
              name: 'Test Channel',
              description: 'Test Description',
            },
            videoId: 'video1',
            title: 'Video 1',
            url: 'https://youtube.com/watch?v=video1',
            publishedAt: '2025-01-01',
          },
        ]);

      mockTranscriptFetcher.fetch.mockResolvedValue({
        method: 'alternative',
        transcript: [{ text: 'Hello', duration: 1000, offset: 0 }],
        transcriptText: 'Hello',
      });
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      const result = await service.extractAll(mockChannels);

      // Assert
      expect(result).toEqual({ succeeded: 1, failed: 1 });
      expect(mockYouTubeService.getChannelVideos).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(1);
    });
  });

  describe('processSingleVideoUrl', () => {
    it('resolves the channel by its database uuid, not the youtube channelId', async () => {
      const channelDbId = 'c23fe6f0-ae5c-409d-910a-2581c7232359';
      mockYoutubeChannelsService.getChannelById.mockResolvedValue(null);

      await expect(
        service.processSingleVideoUrl('https://youtu.be/abc', channelDbId),
      ).rejects.toThrow('not found in configuration');

      expect(mockYoutubeChannelsService.getChannelById).toHaveBeenCalledWith(
        channelDbId,
      );
    });

    it('fetches the transcript through the proxy and enqueues its summary', async () => {
      const channelDbId = 'c23fe6f0-ae5c-409d-910a-2581c7232359';
      mockYoutubeChannelsService.getChannelById.mockResolvedValue({
        id: channelDbId,
        channelId: 'UC123',
        name: 'Test Channel',
        description: 'Test Description',
        maxVideos: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://youtube.com/channel/UC123',
      });
      mockYouTubeService.getVideoMetadata.mockResolvedValue({
        channel: {
          id: 'UC123',
          databaseId: channelDbId,
          name: 'Test Channel',
          description: 'Test Description',
        },
        videoId: 'dQw4w9WgXcQ',
        title: 'Video 1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        publishedAt: '2025-01-01',
      });
      mockTranscriptFetcher.fetch.mockResolvedValue({
        method: 'innertube',
        transcript: [{ text: 'Hello', duration: 1000, offset: 0 }],
        transcriptText: 'Hello',
      });
      jest.spyOn(service, 'addTranscription').mockResolvedValue('t-1');

      const id = await service.processSingleVideoUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        channelDbId,
        'http://proxy:8080',
      );

      expect(id).toBe('t-1');
      expect(mockTranscriptFetcher.fetch).toHaveBeenCalledWith('dQw4w9WgXcQ', {
        proxyUrl: 'http://proxy:8080',
      });
      expect(mockQueueService.addTranscriptionSummaryJob).toHaveBeenCalledWith(
        't-1',
        'Hello',
        'Video 1',
        undefined,
        channelDbId,
      );
    });
  });
});
