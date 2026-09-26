import { AudioJobService } from '@libs/audio';
import { Logger } from '@nestjs/common';
import { DBArticle } from '../articles/article.entity';

/**
 * Enqueues audio for an article's summary. Callers run it after the pipeline
 * succeeds; audio is best-effort, so a failure is logged and never thrown.
 */
export async function enqueueArticleAudio(
  audioJobService: AudioJobService,
  logger: Logger,
  article: DBArticle,
  summary: string,
): Promise<void> {
  try {
    const jobInfo = await audioJobService.enqueueAudioJob({
      sourceType: 'article',
      sourceId: article.id,
      text: summary,
      date: article.published_date
        ? new Date(article.published_date)
        : new Date(),
    });
    logger.log(`Audio generation job enqueued: ${jobInfo.jobId}`);
  } catch (error) {
    logger.error(
      `Error enqueuing audio generation for article ${article.id}`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
