import { QueueService } from '@libs/queue';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';
import { VideoWithTranscript } from '../../shared/types/video';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private outputDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {
    this.outputDir = './transcripts';
  }

  /**
   * Ensure the output directory exists
   */
  private async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      console.log(`Creating output directory: ${this.outputDir}`);
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a timestamp string for the filename
   * @returns Formatted timestamp string (YYYYMMDD_HHMMSS)
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * Save a video transcript to a JSON file
   * @param channelId - The YouTube channel ID
   * @param videoData - The video with transcript data
   */
  async saveTranscript(channelId: string, videoData: VideoWithTranscript) {
    try {
      await this.ensureOutputDirectory();

      const timestamp = this.generateTimestamp();
      const filename = `${channelId}_${timestamp}.json`;
      const filePath = path.join(this.outputDir, filename);

      const data = JSON.stringify(videoData, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');

      console.log(`Saved transcript to: ${filePath}`);

      await this.enqueueBackup(filePath, channelId);
    } catch (error) {
      console.error(
        `Error saving transcript for video ${videoData.videoId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Best-effort S3 backup of a just-written transcript file. Skips (with a
   * warning) when the backup bucket is unconfigured, and never throws into the
   * processing flow: a backup failure must not roll back a saved transcript.
   */
  private async enqueueBackup(
    filePath: string,
    channelId: string,
  ): Promise<void> {
    const bucketName = this.configService.getTranscriptsBackupBucketName();

    if (!bucketName) {
      this.logger.warn(
        `TRANSCRIPTS_BACKUP_BUCKET_NAME is not set; skipping S3 backup for ${filePath}`,
      );
      return;
    }

    try {
      await this.queueService.addTranscriptBackupJob({ filePath, channelId });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue transcript backup for ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Save multiple video transcripts at once
   * @param channelId - The YouTube channel ID
   * @param videosData - Array of videos with transcript data
   */
  async saveTranscripts(channelId: string, videosData: VideoWithTranscript[]) {
    await this.ensureOutputDirectory();

    for (const videoData of videosData) {
      await this.saveTranscript(channelId, videoData);
    }
  }
}
