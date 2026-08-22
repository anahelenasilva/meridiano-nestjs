import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { AudioFilesService } from './audio-files.service';

describe('AudioFilesService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    run: jest.fn(),
  };

  let service: AudioFilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new AudioFilesService(mockDatabaseService);
  });

  describe('deleteAudioFileBySource', () => {
    const sourceId = '11111111-1111-1111-1111-111111111111';

    it('deletes only the row matching the source type and id', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const removed = await service.deleteAudioFileBySource(
        'article',
        sourceId,
      );

      expect(removed).toBe(1);
      const [query, params] = mockDb.run.mock.calls[0];
      expect(query).toContain('DELETE FROM audio_files');
      expect(query).toContain('source_type = ? AND source_id = ?');
      expect(params).toEqual(['article', sourceId]);
    });

    it('returns 0 when the source has no audio row', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const removed = await service.deleteAudioFileBySource(
        'transcription',
        sourceId,
      );

      expect(removed).toBe(0);
    });

    it('rejects when the delete fails', async () => {
      mockDb.run.mockImplementation(function (query, params, callback) {
        callback.call({}, new Error('db down'));
      });

      await expect(
        service.deleteAudioFileBySource('article', sourceId),
      ).rejects.toThrow('db down');
    });
  });
});
