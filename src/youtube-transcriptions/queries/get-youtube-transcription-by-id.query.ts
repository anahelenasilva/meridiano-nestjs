import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { NoteResponseDto } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
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
  transcription: YoutubeTranscription & { note: NoteResponseDto | null };
  audio?: TranscriptionAudioMetadata;
  audio_error?: string;
};

type GetYoutubeTranscriptionByIdOptions = {
  includeAudio?: boolean;
  embedOwnerNote?: boolean;
};

@Injectable()
export class GetYoutubeTranscriptionByIdQuery {
  private readonly logger = new Logger(GetYoutubeTranscriptionByIdQuery.name);

  constructor(
    private readonly service: YoutubeTranscriptionsService,
    private readonly audioFilesService: AudioFilesService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    id: string,
    userId: string,
    options: GetYoutubeTranscriptionByIdOptions = {},
  ): Promise<GetYoutubeTranscriptionByIdResponse | null> {
    const { includeAudio = false, embedOwnerNote = true } = options;
    const transcription = await this.service.getTranscriptionById(id);

    if (!transcription) {
      return null;
    }

    const response: GetYoutubeTranscriptionByIdResponse = {
      transcription: {
        ...transcription,
        note: null,
      },
    };

    if (embedOwnerNote) {
      // Embed the owner's active private note on the transcription, mirroring
      // the Article-detail contract (issue #124): note is a field of the resource.
      const activeNote = await this.notesReadService.getActiveNote(
        userId,
        'transcription',
        id,
      );
      response.transcription.note = activeNote
        ? new NoteResponseDto(activeNote)
        : null;
    }

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
