import { createWorker } from '@libs/queue/create-worker';
import { Logger } from '@nestjs/common';
import { BackupTranscriptJobData } from '@libs/queue';
import { S3Service } from '@libs/s3';
import { Job, Queue } from 'bullmq';
import * as fs from 'fs/promises';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { TranscriptBackupProcessor } from './transcript-backup.processor';

jest.mock('fs/promises');

jest.mock('@libs/queue/create-worker');

describe('TranscriptBackupProcessor', () => {
  const mockQueue = mock<Queue>();
  let processor: TranscriptBackupProcessor;
  const mockS3Service = mock<S3Service>();
  const mockConfigService = mock<ConfigService>();
  const mockedFs = fs as jest.Mocked<typeof fs>;

  const bucketName = 'meridiano-yt-transcripts-bkp';
  const channelId = 'UC123';
  const filePath = 'transcripts/UC123_20260816_120000.json';

  const createJob = (
    overrides?: Partial<BackupTranscriptJobData>,
  ): Job<BackupTranscriptJobData> =>
    ({
      data: { filePath, channelId, ...overrides },
      id: 'backup-1',
      attemptsMade: 0,
      opts: { attempts: 3 },
    }) as Job<BackupTranscriptJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TranscriptBackupProcessor(
      mockQueue,
      mockS3Service,
      mockConfigService,
    );
    mockConfigService.getTranscriptsBackupBucketName.mockReturnValue(
      bucketName,
    );
  });

  describe('backupTranscript', () => {
    it('reads the file and uploads it under <channelId>/<filename> as application/json', async () => {
      const body = Buffer.from(JSON.stringify({ videoId: 'vid-1' }));
      mockedFs.readFile.mockResolvedValue(body);
      mockS3Service.uploadFile.mockResolvedValue(
        `${channelId}/UC123_20260816_120000.json`,
      );

      const result = await processor.backupTranscript(createJob());

      expect(mockedFs.readFile).toHaveBeenCalledWith(filePath);
      expect(mockS3Service.uploadFile).toHaveBeenCalledWith(
        bucketName,
        `${channelId}/UC123_20260816_120000.json`,
        body,
        'application/json',
      );
      expect(result).toEqual({
        success: true,
        key: `${channelId}/UC123_20260816_120000.json`,
      });
    });

    it('throws terminally without uploading when the backup bucket is unset', async () => {
      mockConfigService.getTranscriptsBackupBucketName.mockReturnValue(
        undefined,
      );

      await expect(processor.backupTranscript(createJob())).rejects.toThrow(
        'TRANSCRIPTS_BACKUP_BUCKET_NAME is not set',
      );
      expect(mockS3Service.uploadFile).not.toHaveBeenCalled();
    });

    it('rethrows so BullMQ can retry when the upload fails', async () => {
      mockedFs.readFile.mockResolvedValue(Buffer.from('{}'));
      mockS3Service.uploadFile.mockRejectedValue(new Error('AccessDenied'));

      await expect(processor.backupTranscript(createJob())).rejects.toThrow(
        `Failed to back up transcript ${filePath}`,
      );
    });
  });

  describe('onModuleInit', () => {
    it('starts a worker on the transcript backup queue', () => {
      processor.onModuleInit();

      expect(createWorker).toHaveBeenCalledWith(mockQueue, expect.any(Function), {
        logger: expect.any(Logger),
      });
    });
  });
});
