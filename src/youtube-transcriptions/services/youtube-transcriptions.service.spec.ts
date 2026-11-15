import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockReset } from 'jest-mock-extended';

import { DatabaseService } from '@libs/database';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { AudioFilesCleanupService } from '../../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../../notes/notes-cleanup.service';
import { YoutubeTranscriptionsService } from './youtube-transcriptions.service';

describe('YoutubeTranscriptionsService', () => {
  let service: YoutubeTranscriptionsService;
  let app: INestApplication;

  // Mock implementations
  const mockDatabaseService = mock<DatabaseService>();
  const mockNotesCleanupService = mock<NotesCleanupService>();
  const mockAudioFilesCleanupService = mock<AudioFilesCleanupService>();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeTranscriptionsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: NotesCleanupService,
          useValue: mockNotesCleanupService,
        },
        {
          provide: AudioFilesCleanupService,
          useValue: mockAudioFilesCleanupService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    service = module.get<YoutubeTranscriptionsService>(
      YoutubeTranscriptionsService,
    );
  });

  beforeEach(() => {
    mockReset(mockDatabaseService);
    mockReset(mockNotesCleanupService);
    mockNotesCleanupService.purgeNotesForSource.mockResolvedValue(0);
    mockReset(mockAudioFilesCleanupService);
    mockAudioFilesCleanupService.purgeAudioForSource.mockResolvedValue();
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

  describe('delete', () => {
    const transcriptionId = '33333333-3333-3333-3333-333333333333';
    type RunCallback = (this: { changes?: number }, err: Error | null) => void;

    const deleteReports = (changes: number, err: Error | null = null) => {
      const mockDb = {
        run: jest.fn((_sql: string, _params: unknown[], cb: RunCallback) => {
          cb.call({ changes }, err);
        }),
      };
      mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
      return mockDb;
    };

    it('deletes the row, then purges its notes and audio', async () => {
      const mockDb = deleteReports(1);

      await service.delete(transcriptionId);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM youtube_transcriptions'),
        [transcriptionId],
        expect.any(Function),
      );
      expect(mockNotesCleanupService.purgeNotesForSource).toHaveBeenCalledWith(
        'transcription',
        transcriptionId,
      );
      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).toHaveBeenCalledWith('transcription', transcriptionId);
    });

    it('throws NotFoundException and purges nothing when no row matches', async () => {
      deleteReports(0);

      await expect(service.delete(transcriptionId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(
        mockNotesCleanupService.purgeNotesForSource,
      ).not.toHaveBeenCalled();
      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).not.toHaveBeenCalled();
    });

    it('does not purge notes or audio when the transcription delete fails', async () => {
      deleteReports(0, new Error('delete failed'));

      await expect(service.delete(transcriptionId)).rejects.toThrow(
        'delete failed',
      );
      expect(
        mockNotesCleanupService.purgeNotesForSource,
      ).not.toHaveBeenCalled();
      expect(
        mockAudioFilesCleanupService.purgeAudioForSource,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findExistingVideoUrls', () => {
    it('returns the subset of urls already stored', async () => {
      const mockDb = {
        all: jest.fn(
          (
            _sql: string,
            _params: string[],
            cb: (e: Error | null, rows: unknown[]) => void,
          ) =>
            cb(null, [{ video_url: 'https://www.youtube.com/watch?v=abc123' }]),
        ),
      };
      mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);

      const found = await service.findExistingVideoUrls([
        'https://www.youtube.com/watch?v=abc123',
        'https://www.youtube.com/watch?v=def456',
      ]);

      expect(found.has('https://www.youtube.com/watch?v=abc123')).toBe(true);
      expect(found.has('https://www.youtube.com/watch?v=def456')).toBe(false);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('IN (?, ?)'),
        [
          'https://www.youtube.com/watch?v=abc123',
          'https://www.youtube.com/watch?v=def456',
        ],
        expect.any(Function),
      );
    });

    it('skips the query entirely for an empty list', async () => {
      const mockDb = { all: jest.fn() };
      mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);

      const found = await service.findExistingVideoUrls([]);

      expect(found.size).toBe(0);
      expect(mockDb.all).not.toHaveBeenCalled();
    });
  });
});
