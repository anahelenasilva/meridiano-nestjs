import { S3Service } from '@libs/s3';
import { Injectable, Logger } from '@nestjs/common';
import { AudioFilesService } from '../../audio-files/audio-files.service';
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
  ) {}

  async execute(articleId: string, includeAudio: boolean = false) {
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

    // Include audio metadata if requested
    let audio: AudioMetadata | undefined;
    if (includeAudio) {
      try {
        const audioFile = await this.audioFilesService.getAudioFileBySource(
          'article',
          articleId,
        );

        if (audioFile) {
          const presignedUrl = await this.s3Service.generatePresignedGetUrl(
            audioFile.s3_bucket,
            audioFile.s3_key,
            3600, // 1 hour expiration
          );

          audio = {
            id: audioFile.id,
            s3_key: audioFile.s3_key,
            file_size_bytes: audioFile.file_size_bytes,
            duration_seconds: audioFile.duration_seconds,
            presigned_url: presignedUrl,
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch audio for article ${articleId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Leave audio undefined so the article is returned without audio
      }
    }

    const articleResponse: any = {
      ...preparedArticle,
    };

    if (audio) {
      articleResponse.audio = audio;
    }

    return {
      article: articleResponse,
      related_articles: preparedRelatedArticles,
    };
  }
}
