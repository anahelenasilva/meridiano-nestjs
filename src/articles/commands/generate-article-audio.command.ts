import { AudioJobService, AUDIO_GENERATION_SUCCESS_MESSAGE } from '@libs/audio';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import type { DBArticle } from '../article.entity';
import { ArticlesService } from '../articles.service';

export type GenerateArticleAudioCommandResponse = {
  jobId: string;
  message: string;
};

function selectContentForTts(article: DBArticle): string | null {
  const text = article.processed_content || article.raw_content;
  if (!text || text.trim().length === 0) {
    return null;
  }
  return text;
}

@Injectable()
export class GenerateArticleAudioCommand {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly audioFilesService: AudioFilesService,
    private readonly audioJobService: AudioJobService,
  ) {}

  async execute(
    articleId: string,
  ): Promise<GenerateArticleAudioCommandResponse> {
    const article = await this.articlesService.getArticleById(articleId);

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const existingAudio = await this.audioFilesService.getAudioFileBySource(
      'article',
      articleId,
    );

    if (existingAudio) {
      throw new ConflictException(
        'Audio already exists for this resource. Use the detail endpoint with includeAudio=true to fetch the audio.',
      );
    }

    const text = selectContentForTts(article);

    if (!text) {
      throw new BadRequestException(
        'Article has no content available for audio generation',
      );
    }

    const jobInfo = await this.audioJobService.enqueueAudioJobIfNotDuplicate({
      sourceType: 'article',
      sourceId: articleId,
      text,
      date: article.published_date,
    });

    if (!jobInfo) {
      throw new ConflictException(
        'Audio generation is already in progress for this resource.',
      );
    }

    return {
      jobId: jobInfo.jobId,
      message: AUDIO_GENERATION_SUCCESS_MESSAGE,
    };
  }
}
