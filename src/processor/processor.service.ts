import { AudioJobService } from '@libs/audio';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DBArticle } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProcessingStats } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { ArticleProcessingPipelineService } from './pipeline/article-processing-pipeline.service';
import { SLEEPER } from './pipeline/sleeper';
import type { Sleeper } from './pipeline/sleeper';

/**
 * Batch stages for the scheduled briefing run and markdown uploads. Each stage
 * loads the articles still waiting on one step, runs that step through the
 * {@link ArticleProcessingPipelineService} per article, and reports counts. Pass
 * `articleId` to run a stage for that one article.
 */
@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);

  constructor(
    private readonly articlesService: ArticlesService,
    private readonly pipeline: ArticleProcessingPipelineService,
    @Inject(SLEEPER) private readonly sleeper: Sleeper,
    private readonly configService: ConfigService,
    private readonly audioJobService: AudioJobService,
  ) {}

  async processArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
    generateAudio?: boolean,
  ): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = articleId
      ? await this.byId(
          this.articlesService.getUnprocessedArticleById(articleId),
        )
      : await this.articlesService.getUnprocessedArticles(feedProfile, limit);

    this.logger.log(`Found ${articles.length} articles to summarise.`);

    for (const article of articles) {
      const result = await this.pipeline.summariseArticle(article);
      if (result.success) {
        stats.articlesProcessed++;
        if (generateAudio) {
          await this.enqueueAudio(article, result.value);
        }
      } else {
        stats.errors++;
      }
      await this.pause();
    }

    return this.finish(stats, `Summarised ${stats.articlesProcessed}`);
  }

  async rateArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
  ): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = articleId
      ? await this.byId(this.articlesService.getUnratedArticleById(articleId))
      : await this.articlesService.getUnratedArticles(feedProfile, limit);

    this.logger.log(`Found ${articles.length} articles to rate.`);

    for (const article of articles) {
      if (!article.processed_content) {
        this.logger.warn(`Skipping article ${article.id} - no summary found.`);
        continue;
      }
      const result = await this.pipeline.rateArticle(
        article,
        article.processed_content,
      );
      if (result.success) {
        stats.articlesRated++;
      } else {
        stats.errors++;
      }
      await this.pause();
    }

    return this.finish(stats, `Rated ${stats.articlesRated}`);
  }

  async categorizeArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
  ): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = articleId
      ? await this.byId(
          this.articlesService.getUncategorizedArticleById(articleId),
        )
      : await this.articlesService.getUncategorizedArticles(feedProfile, limit);

    this.logger.log(`Found ${articles.length} articles to categorise.`);

    for (const article of articles) {
      if (!article.processed_content) {
        this.logger.warn(`Skipping article ${article.id} - no summary found.`);
        continue;
      }
      const result = await this.pipeline.categoriseArticle(
        article,
        article.processed_content,
      );
      if (result.success) {
        stats.articlesCategorized++;
      } else {
        stats.errors++;
      }
      await this.pause();
    }

    return this.finish(stats, `Categorised ${stats.articlesCategorized}`);
  }

  private async byId(lookup: Promise<DBArticle | null>): Promise<DBArticle[]> {
    const article = await lookup;
    return article ? [article] : [];
  }

  private newStats(feedProfile: FeedProfile): ProcessingStats {
    return {
      feedProfile,
      articlesProcessed: 0,
      articlesRated: 0,
      articlesCategorized: 0,
      errors: 0,
      startTime: new Date(),
    };
  }

  private finish(stats: ProcessingStats, summary: string): ProcessingStats {
    stats.endTime = new Date();
    this.logger.log(`${summary} articles, ${stats.errors} failed.`);
    return stats;
  }

  private pause(): Promise<void> {
    return this.sleeper.sleep(this.configService.getArticleProcessingDelayMs());
  }

  private async enqueueAudio(
    article: DBArticle,
    summary: string,
  ): Promise<void> {
    try {
      const jobInfo = await this.audioJobService.enqueueAudioJob({
        sourceType: 'article',
        sourceId: article.id,
        text: summary,
        date: article.published_date
          ? new Date(article.published_date)
          : new Date(),
      });
      this.logger.log(`Audio generation job enqueued: ${jobInfo.jobId}`);
    } catch (error) {
      // Audio is best-effort; a failure here must not fail article processing.
      this.logger.error(
        `Error enqueuing audio generation for article ${article.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
