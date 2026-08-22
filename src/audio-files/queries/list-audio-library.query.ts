import { S3Service } from '@libs/s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../audio-files.service';

export type ListAudioLibraryRequest = {
  page?: number;
  perPage?: number;
};

export type AudioLibraryItem = {
  audio_id: string;
  source_type: 'article' | 'transcription';
  source_id: string;
  title: string;
  source_label: string;
  published_at: string | null;
  audio: {
    duration_seconds?: number;
    file_size_bytes: number;
    presigned_url: string;
    created_at: Date;
  };
};

export type ListAudioLibraryResponse = {
  audios: AudioLibraryItem[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_audios: number;
  };
};

@Injectable()
export class ListAudioLibraryQuery {
  constructor(
    private readonly audioFilesService: AudioFilesService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    request: ListAudioLibraryRequest,
  ): Promise<ListAudioLibraryResponse> {
    // Query-string params arrive as strings; Number() normalizes both forms.
    const page = Math.max(1, Number(request.page) || 1);
    const perPage = Math.max(1, Number(request.perPage) || 20);
    const offset = (page - 1) * perPage;

    const totalAudios = await this.audioFilesService.countAudioLibrary();
    const entries = await this.audioFilesService.listAudioLibrary(
      perPage,
      offset,
    );
    const expirySeconds = this.configService.getPresignedUrlExpirySeconds();

    const audios: AudioLibraryItem[] = await Promise.all(
      entries.map(async (entry) => ({
        audio_id: entry.audio_id,
        source_type: entry.source_type,
        source_id: entry.source_id,
        title: entry.title,
        source_label: entry.source_label,
        published_at: entry.published_at,
        audio: {
          duration_seconds: entry.duration_seconds,
          file_size_bytes: entry.file_size_bytes,
          presigned_url: await this.s3Service.generatePresignedGetUrl(
            entry.s3_bucket,
            entry.s3_key,
            expirySeconds,
          ),
          created_at: entry.created_at,
        },
      })),
    );

    return {
      audios,
      pagination: {
        page,
        per_page: perPage,
        total_pages: Math.ceil(totalAudios / perPage),
        total_audios: totalAudios,
      },
    };
  }
}
