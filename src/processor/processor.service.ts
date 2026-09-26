import { AudioJobService } from '@libs/audio';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProcessingStats } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';
import { enqueueArticleAudio } from './enqueue-article-audio';
import { ArticleProcessingPipelineService } from './pipeline/article-processing-pipeline.service';
import { SLEEPER } from './pipeline/sleeper';
import type { Sleeper } from './pipeline/sleeper';

const BATCH_LIMIT = 1000;

/**
 * Batch stages for the scheduled briefing run. Each stage loads the articles
 * still waiting on one step, runs that step through the
 * {@link ArticleProcessingPipelineService} per article, and reports counts.
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
    generateAudio?: boolean,
  ): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = await this.articlesService.getUnprocessedArticles(
      feedProfile,
      BATCH_LIMIT,
    );

    this.logger.log(`Found ${articles.length} articles to summarise.`);

    for (const article of articles) {
      const result = await this.pipeline.summariseArticle(article);
      if (result.success) {
        stats.articlesProcessed++;
        if (generateAudio) {
          await enqueueArticleAudio(
            this.audioJobService,
            this.logger,
            article,
            result.value,
          );
        }
      } else {
        stats.errors++;
      }
      await this.pause();
    }

    return this.finish(stats, `Summarised ${stats.articlesProcessed}`);
  }

  async rateArticles(feedProfile: FeedProfile): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = await this.articlesService.getUnratedArticles(
      feedProfile,
      BATCH_LIMIT,
    );

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

  async categorizeArticles(feedProfile: FeedProfile): Promise<ProcessingStats> {
    const stats = this.newStats(feedProfile);
    const articles = await this.articlesService.getUncategorizedArticles(
      feedProfile,
      BATCH_LIMIT,
    );

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

  private finish(stats: ProcessingStats, outcome: string): ProcessingStats {
    stats.endTime = new Date();
    this.logger.log(`${outcome} articles, ${stats.errors} failed.`);
    return stats;
  }

  private pause(): Promise<void> {
    return this.sleeper.sleep(this.configService.getArticleProcessingDelayMs());
  }
}
