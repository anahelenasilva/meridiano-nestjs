import { BackupTranscriptJobData, TRANSCRIPT_BACKUP_QUEUE } from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import { S3Service } from '@libs/s3';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class TranscriptBackupProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TranscriptBackupProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(TRANSCRIPT_BACKUP_QUEUE)
    private readonly queue: Queue,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      this.queue,
      (job: Job<BackupTranscriptJobData>) => this.backupTranscript(job),
      { logger: this.logger },
    );

    this.logger.log('Transcript backup processor worker initialized');
  }

  async backupTranscript(
    job: Job<BackupTranscriptJobData>,
  ): Promise<{ success: boolean; key: string }> {
    const { filePath, channelId } = job.data;
    const key = `${channelId}/${path.basename(filePath)}`;
    const bucketName = this.configService.getTranscriptsBackupBucketName();

    if (!bucketName) {
      // Guard against a job enqueued while configured, then run after the env
      // var was removed. Nothing to back up to; fail terminally without retry.
      throw new Error(
        `TRANSCRIPTS_BACKUP_BUCKET_NAME is not set; cannot back up ${filePath} (key ${key})`,
      );
    }

    try {
      const body = await fs.readFile(filePath);
      await this.s3Service.uploadFile(
        bucketName,
        key,
        body,
        'application/json',
      );

      this.logger.log(
        `Backed up transcript ${filePath} to s3://${bucketName}/${key}`,
      );

      return { success: true, key };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Re-throw on every attempt (including the last): BullMQ needs the throw to
      // schedule retries and, once attempts are exhausted, to move the job into the
      // retained failed set (removeOnFail: false) for later inspection. The throw is
      // contained by the worker and never reaches the transcript processing flow.
      throw new Error(
        `Failed to back up transcript ${filePath} to key ${key}: ${errorMessage}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
