import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { NoteResponseDto } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ArticlesService } from '../articles.service';
import { prepareArticleContent } from '../helpers/prepareArticleContent';

interface AudioMetadata {
  id: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number;
  presigned_url: string;
}

@Injectable()
export class GetArticleByIdQuery {
  private readonly logger = new Logger(GetArticleByIdQuery.name);

  constructor(
    private readonly service: ArticlesService,
    private readonly audioFilesService: AudioFilesService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    articleId: string,
    userId: string,
    includeAudio: boolean = false,
  ) {
    const article = await this.service.getArticleById(articleId);

    if (!article) {
      return null;
    }

    const relatedArticles = await this.service.getRelatedArticles(articleId, 5);

    // Prepare article and related articles with HTML content
    const preparedArticle = await prepareArticleContent(article);
    const preparedRelatedArticles = await Promise.all(
      relatedArticles.map((article) => prepareArticleContent(article)),
    );

    let audio: AudioMetadata | undefined;
    let audioError: string | undefined;
    if (includeAudio) {
      try {
        const audioFile = await this.audioFilesService.getAudioFileBySource(
          'article',
          articleId,
        );

        if (audioFile) {
          const expirySeconds =
            this.configService.getPresignedUrlExpirySeconds();
          const presignedUrl = await this.s3Service.generatePresignedGetUrl(
            audioFile.s3_bucket,
            audioFile.s3_key,
            expirySeconds,
          );

          audio = {
            id: audioFile.id,
            s3_key: audioFile.s3_key,
            file_size_bytes: audioFile.file_size_bytes,
            duration_seconds: audioFile.duration_seconds,
            presigned_url: presignedUrl,
          };
        } else {
          audioError = 'Audio not available for this resource';
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch audio for article ${articleId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        audioError = 'Failed to fetch audio';
      }
    }

    // Embed the owner's active private note on the primary Article only.
    // related_articles are intentionally left note-free (issue #122).
    const activeNote = await this.notesReadService.getActiveNote(
      userId,
      'article',
      articleId,
    );

    const articleResponse: Record<string, unknown> = {
      ...preparedArticle,
      note: activeNote ? new NoteResponseDto(activeNote) : null,
    };

    if (audio) {
      articleResponse.audio = audio;
    }
    if (audioError) {
      articleResponse.audio_error = audioError;
    }

    return {
      article: articleResponse,
      related_articles: preparedRelatedArticles,
    };
  }
}
