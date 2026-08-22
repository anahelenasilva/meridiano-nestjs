import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { AudioFilesService } from './audio-files.service';

@Injectable()
export class AudioFilesCleanupService {
  private readonly logger = new Logger(AudioFilesCleanupService.name);

  constructor(
    private readonly audioFilesService: AudioFilesService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Removes the audio a source owns when that source is deleted: first the S3
   * object, then the audio_files row. S3 goes first so that if it fails the row
   * stays behind as a pointer to retry from rather than an orphaned object with
   * no record. The reverse order can leave a row pointing at a deleted object,
   * but S3 DeleteObject is idempotent so retrying still converges. Only the
   * exact key recorded for this source is touched, so the blast radius never
   * extends beyond the one object.
   */
  async purgeAudioForSource(
    sourceType: 'article' | 'transcription',
    sourceId: string,
  ): Promise<void> {
    const audioFile = await this.audioFilesService.getAudioFileBySource(
      sourceType,
      sourceId,
    );

    if (!audioFile) {
      return;
    }

    await this.s3Service.deleteObject(audioFile.s3_bucket, audioFile.s3_key);
    await this.audioFilesService.deleteAudioFileBySource(sourceType, sourceId);

    this.logger.log(
      `Purged audio for ${sourceType} ${sourceId} (${audioFile.s3_bucket}/${audioFile.s3_key})`,
    );
  }
}
