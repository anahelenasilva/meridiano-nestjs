// Mock the services before importing them
jest.mock('./youtube.service');
jest.mock('./transcript.service');
jest.mock('./storage.service');

import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from './storage.service';
import { TranscriptService } from './transcript.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';
import { YouTubeService } from './youtube.service';

describe('YoutubeTranscriptionsService', () => {
  let service: YoutubeTranscriptionsService;

  // Mock implementations
  const mockYouTubeService = {
    getChannelVideos: jest.fn(),
  };

  const mockTranscriptService = {
    getTranscript: jest.fn(),
    transcriptToText: jest.fn(),
  };

  const mockStorageService = {
    saveTranscript: jest.fn(),
    saveTranscripts: jest.fn(),
  };

  const mockDatabaseService = {
    saveTranscriptionToDatabase: jest.fn(),
  };

  const mockAiService = {
    callDeepseekChat: jest.fn(),
  };

  const mockConfigService = {
    getTranscriptionSummaryPrompt: jest.fn(),
  };

  beforeEach(async () => {
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
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<YoutubeTranscriptionsService>(
      YoutubeTranscriptionsService,
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractChannelTranscripts', () => {
    it('should extract transcripts from a channel successfully', async () => {
      // Arrange
      const mockChannel = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
      };

      const mockVideos = [
        {
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
        {
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

      // Act
      await service.extractChannelTranscripts(mockChannel);

      // Assert
      expect(mockYouTubeService.getChannelVideos).toHaveBeenCalledWith(
        mockChannel,
      );
      expect(mockTranscriptService.getTranscript).toHaveBeenCalledTimes(2);
      expect(mockStorageService.saveTranscript).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no transcripts are successfully extracted', async () => {
      // Arrange
      const mockChannel = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 1,
      };

      const mockVideos = [
        {
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
        service.extractChannelTranscripts(mockChannel),
      ).rejects.toThrow(
        'Failed to extract any transcripts from channel Test Channel',
      );
    });

    it('should continue processing when some videos fail', async () => {
      // Arrange
      const mockChannel = {
        channelId: 'UC123',
        channelName: 'Test Channel',
        channelDescription: 'Test Description',
        maxVideos: 2,
      };

      const mockVideos = [
        {
          videoId: 'video1',
          title: 'Video 1',
          url: 'https://youtube.com/watch?v=video1',
          publishedAt: '2025-01-01',
        },
        {
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
      await service.extractChannelTranscripts(mockChannel);

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

      const mockVideos = [
        {
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

      mockYouTubeService.getChannelVideos
        .mockRejectedValueOnce(new Error('Channel not found'))
        .mockResolvedValueOnce([
          {
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
