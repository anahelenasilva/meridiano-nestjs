import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockReset } from 'jest-mock-extended';

import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';
import { ChannelConfig } from '../shared/types/channel';
import { VideoMetadata } from '../shared/types/video';
import { YoutubeChannel } from '../youtube-channels/domain/youtube-channel';
import { YoutubeChannelsService } from '../youtube-channels/youtube-channels.service';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

describe('YoutubeTranscriptionsService', () => {
  let service: YoutubeTranscriptionsService;
  let app: INestApplication;

  // Mock implementations
  const mockYouTubeService = mock<YouTubeService>();
  const mockTranscriptService = mock<TranscriptService>();
  const mockStorageService = mock<StorageService>();
  const mockDatabaseService = mock<DatabaseService>();
  const mockQueueService = mock<QueueService>();
  const mockYoutubeChannelsService = mock<YoutubeChannelsService>();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeTranscriptionsService,
        {
          provide: YouTubeService,
          useValue: mockYouTubeService,
        },
        {
          provide: TranscriptService,
          useValue: mockTranscriptService,
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
      ],
    })
      .overrideProvider(YoutubeTranscriptionsService) // override the dependency with the mocked version
      .useValue(service)
      .compile();

    app = module.createNestApplication();
    await app.init();

    service = module.get<YoutubeTranscriptionsService>(YoutubeTranscriptionsService);
  });

  beforeEach(() => {
    mockReset(mockYouTubeService);
    mockReset(mockTranscriptService);
    mockReset(mockStorageService);
    mockReset(mockDatabaseService);
    mockReset(mockQueueService);
    mockReset(mockYoutubeChannelsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      }

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
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
      mockTranscriptService.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptService.transcriptToText.mockReturnValue('Hello World');
      mockStorageService.saveTranscript.mockResolvedValue(undefined);
      mockYoutubeChannelsService.getChannelById.mockResolvedValue(mockChannel);

      // Act
      await service.extractChannelTranscripts(mockChannelConfig);

      // Assert
      expect(mockYouTubeService.getChannelVideos).toHaveBeenNthCalledWith(1, mockChannelConfig);
      expect(mockTranscriptService.getTranscript).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no transcripts are successfully extracted', async () => {
      // Arrange
      const mockChannelConfig: ChannelConfig = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
      }

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
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
      mockTranscriptService.getTranscript.mockRejectedValue(
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
      }

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
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
            name: 'Test Channel',
            description: 'Test Description',
          },
          videoId: 'video2',
          title: 'Video 2',
          url: 'https://youtube.com/watch?v=video2',
          publishedAt: '2025-01-02',
        },
      ];

      const mockTranscript = [{ text: 'Hello', duration: 1000, offset: 0 }];

      mockYouTubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockTranscriptService.getTranscript
        .mockRejectedValueOnce(new Error('Transcript not available'))
        .mockResolvedValueOnce(mockTranscript);
      mockTranscriptService.transcriptToText.mockReturnValue('Hello');
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      await service.extractChannelTranscripts(mockChannelConfig);

      // Assert
      expect(mockTranscriptService.getTranscript).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractAll', () => {
    it('should extract transcripts from all channels', async () => {
      // Arrange
      const mockChannels = [
        {
          channelId: 'UC123',
          channelName: 'Channel 1',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
        {
          channelId: 'UC456',
          channelName: 'Channel 2',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
      ];

      const mockVideos: VideoMetadata[] = [
        {
          channel: {
            id: 'UC123',
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
      mockTranscriptService.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptService.transcriptToText.mockReturnValue('Hello');
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      await service.extractAll(mockChannels);

      // Assert
      expect(mockYouTubeService.getChannelVideos).toHaveBeenCalledTimes(2);
    });

    it('should continue when some channels fail', async () => {
      // Arrange
      const mockChannels: ChannelConfig[] = [
        {
          channelId: 'UC123',
          channelName: 'Channel 1',
          channelDescription: 'Test Description',
          maxVideos: 1,
        },
        {
          channelId: 'UC456',
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
              name: 'Test Channel',
              description: 'Test Description',
            },
            videoId: 'video1',
            title: 'Video 1',
            url: 'https://youtube.com/watch?v=video1',
            publishedAt: '2025-01-01',
          },
        ]);

      mockTranscriptService.getTranscript.mockResolvedValue([
        { text: 'Hello', duration: 1000, offset: 0 },
      ]);
      mockTranscriptService.transcriptToText.mockReturnValue('Hello');
      mockStorageService.saveTranscript.mockResolvedValue(undefined);

      // Act
      await service.extractAll(mockChannels);

      // Assert
      expect(mockYouTubeService.getChannelVideos).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(1);
    });
  });
});
