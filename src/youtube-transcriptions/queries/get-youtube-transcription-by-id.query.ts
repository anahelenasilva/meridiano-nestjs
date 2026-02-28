import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { YoutubeTranscription } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../services/youtube-transcriptions.service';

export type TranscriptionAudioMetadata = {
  id: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number;
  presigned_url: string;
};

export type GetYoutubeTranscriptionByIdResponse = {
  transcription: YoutubeTranscription;
  audio?: TranscriptionAudioMetadata;
  audio_error?: string;
};

@Injectable()
export class GetYoutubeTranscriptionByIdQuery {
  private readonly logger = new Logger(GetYoutubeTranscriptionByIdQuery.name);

  constructor(
    private readonly service: YoutubeTranscriptionsService,
    private readonly audioFilesService: AudioFilesService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    id: string,
    includeAudio: boolean = false,
  ): Promise<GetYoutubeTranscriptionByIdResponse | null> {
    const transcription = await this.service.getTranscriptionById(id);

    if (!transcription) {
      return null;
    }

    const response: GetYoutubeTranscriptionByIdResponse = {
      transcription,
    };

    if (includeAudio) {
      try {
        const audioFile = await this.audioFilesService.getAudioFileBySource(
          'transcription',
          id,
        );

        if (audioFile) {
          const expirySeconds =
            this.configService.getPresignedUrlExpirySeconds();
          const presignedUrl = await this.s3Service.generatePresignedGetUrl(
            audioFile.s3_bucket,
            audioFile.s3_key,
            expirySeconds,
          );

          response.audio = {
            id: audioFile.id,
            s3_key: audioFile.s3_key,
            file_size_bytes: audioFile.file_size_bytes,
            duration_seconds: audioFile.duration_seconds,
            presigned_url: presignedUrl,
          };
        } else {
          response.audio_error = 'Audio not available for this resource';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch audio for transcription ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        response.audio_error = 'Failed to fetch audio';
      }
    }

    return response;
  }
}
