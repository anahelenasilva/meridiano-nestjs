import { QueueService } from '@libs/queue';
import { Logger } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import * as fs from 'fs/promises';
import { ConfigService } from '../../config/config.service';
import { VideoWithTranscript } from '../../shared/types/video';
import { StorageService } from './storage.service';

jest.mock('fs/promises');

describe('StorageService', () => {
  let service: StorageService;
  const mockConfigService = mock<ConfigService>();
  const mockQueueService = mock<QueueService>();
  const mockedFs = fs as jest.Mocked<typeof fs>;

  const channelId = 'UC123';
  const videoData = {
    videoId: 'vid-1',
    title: 'Test Video',
  } as VideoWithTranscript;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    service = new StorageService(mockConfigService, mockQueueService);
  });

  describe('saveTranscript', () => {
    it('enqueues a backup job with filePath and channelId when the bucket is configured', async () => {
      mockConfigService.getTranscriptsBackupBucketName.mockReturnValue(
        'meridiano-yt-transcripts-bkp',
      );

      await service.saveTranscript(channelId, videoData);

      expect(mockQueueService.addTranscriptBackupJob).toHaveBeenCalledTimes(1);
      expect(mockQueueService.addTranscriptBackupJob).toHaveBeenCalledWith({
        filePath: expect.stringContaining(`${channelId}_`),
        channelId,
      });
    });

    it('does not enqueue and warns when the backup bucket is unset', async () => {
      mockConfigService.getTranscriptsBackupBucketName.mockReturnValue(
        undefined,
      );
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await service.saveTranscript(channelId, videoData);

      expect(mockQueueService.addTranscriptBackupJob).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('TRANSCRIPTS_BACKUP_BUCKET_NAME is not set'),
      );
    });

    it('does not throw into the processing flow when enqueue fails', async () => {
      mockConfigService.getTranscriptsBackupBucketName.mockReturnValue(
        'meridiano-yt-transcripts-bkp',
      );
      mockQueueService.addTranscriptBackupJob.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(
        service.saveTranscript(channelId, videoData),
      ).resolves.toBeUndefined();
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
    });
  });
});
