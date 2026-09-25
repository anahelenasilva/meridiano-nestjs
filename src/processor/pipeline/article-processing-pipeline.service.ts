import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import { ArticleCategory, DBArticle } from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { buildFinalPrompt } from '../../shared/helpers/build-final-prompt';
import { ImpactRating } from '../../shared/types/ai';
import { FeedProfile } from '../../shared/types/feed';
import { AI_ADAPTER } from './ai-adapter.token';
import { PROCESSING_NOTIFIER } from './processing-notifier';
import type { ProcessingNotifier } from './processing-notifier';
import {
  ProcessingFailure,
  ProcessingResult,
  ProcessingStep,
  StepResult,
} from './processing-result';
import { SLEEPER } from './sleeper';
import type { Sleeper } from './sleeper';

const SUMMARY_CONTENT_LIMIT = 4000;
const CATEGORY_CONTENT_LIMIT = 2000;

/**
 * Thrown when the summary was persisted but its embedding failed, so the
 * failure result still carries the summary.
 */
class EmbeddingFailedError extends Error {
  constructor(
    message: string,
    readonly summary: string,
  ) {
    super(message);
    this.name = 'EmbeddingFailedError';
  }
}

/**
 * Deep module for the Article Summary -> Impact Rating -> categorisation
 * pipeline. The queue worker runs all three steps through `processArticle`; the
 * scheduled briefing run calls `summariseArticle`, `rateArticle` and
 * `categoriseArticle` as separate batch stages. Each entry point alerts through
 * the notifier once when its step fails. It depends on the {@link AiAdapter}
 * interface (never the concrete `AiService`) so it can be unit tested with a
 * fake adapter and no real provider, database, or queue.
 */
@Injectable()
export class ArticleProcessingPipelineService {
  private readonly logger = new Logger(ArticleProcessingPipelineService.name);

  constructor(
    @Inject(AI_ADAPTER) private readonly ai: AiAdapter,
    @Inject(SLEEPER) private readonly sleeper: Sleeper,
    @Inject(PROCESSING_NOTIFIER)
    private readonly notifier: ProcessingNotifier,
    private readonly articlesService: ArticlesService,
    private readonly configService: ConfigService,
    private readonly profilesService: ProfilesService,
  ) {}

  async processArticle(article: DBArticle): Promise<ProcessingResult> {
    const delayMs = this.configService.getArticleProcessingDelayMs();

    const summarised = await this.summariseArticle(article);
    if (!summarised.success) return summarised;
    const summary = summarised.value;
    await this.sleeper.sleep(delayMs);

    const rated = await this.rateArticle(article, summary);
    if (!rated.success) return rated;
    const rating = rated.value;
    await this.sleeper.sleep(delayMs);

    const categorised = await this.categoriseArticle(article, summary);
    if (!categorised.success) return { ...categorised, rating };

    return { success: true, summary, rating, categories: categorised.value };
  }

  /**
   * Generates the summary, embeds it, and persists both. The summary is
   * persisted even when embedding fails, but the step still fails so the
   * failure is alerted and counted.
   */
  summariseArticle(article: DBArticle): Promise<StepResult<string>> {
    return this.runStep(article, 'summarise', {}, () =>
      this.summarise(article),
    );
  }

  /** Rates `summary`; the batch stage passes the article's saved `processed_content`. */
  rateArticle(
    article: DBArticle,
    summary: string,
  ): Promise<StepResult<ImpactRating>> {
    return this.runStep(article, 'rate', { summary }, () =>
      this.rate(article, summary),
    );
  }

  /**
   * Categorises `summary`; the batch stage passes the article's saved
   * `processed_content`. A missing or unparseable AI response falls back to
   * OTHER; only a persistence error fails the step.
   */
  categoriseArticle(
    article: DBArticle,
    summary: string,
  ): Promise<StepResult<ArticleCategory[]>> {
    return this.runStep(article, 'categorise', { summary }, () =>
      this.categorise(article, summary),
    );
  }

  private async runStep<T>(
    article: DBArticle,
    step: ProcessingStep,
    partial: Pick<ProcessingFailure, 'summary'>,
    run: () => Promise<T>,
  ): Promise<StepResult<T>> {
    try {
      return { success: true, value: await run() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const summary =
        error instanceof EmbeddingFailedError ? error.summary : partial.summary;

      this.logger.error(
        `Article ${article.id} failed at ${step} step: ${message}`,
      );
      await this.notifier.notifyFailure({ article, step, error: message });

      return { success: false, failedStep: step, error: message, summary };
    }
  }

  private async summarise(article: DBArticle): Promise<string> {
    const prompts = this.promptsFor(article);
    const articleTitle = article.title || article.feed_source || 'Untitled';

    const baseSummaryPrompt = prompts.articleSummary
      ? this.configService.formatPrompt(prompts.articleSummary, {
          article_content: article.raw_content.substring(
            0,
            SUMMARY_CONTENT_LIMIT,
          ),
          article_title: articleTitle,
        })
      : this.configService.getArticleSummaryPrompt(
          article.raw_content.substring(0, SUMMARY_CONTENT_LIMIT),
        );

    const summaryPrompt = buildFinalPrompt(
      baseSummaryPrompt,
      article.custom_prompt,
    );

    const summary = await this.ai.chat(summaryPrompt);
    if (!summary) {
      throw new Error(
        `Summarisation returned no content for article ${article.id}`,
      );
    }

    const finalSummary = `${summary}\n\nSource: [${article.title}](${article.url})`;

    let embedding: number[] | null = null;
    let embeddingError: string | null = null;
    try {
      embedding = await this.ai.embed(finalSummary);
    } catch (error) {
      embeddingError = error instanceof Error ? error.message : String(error);
    }
    if (!embedding && !embeddingError) {
      embeddingError = 'Embedding returned null';
    }

    await this.articlesService.updateArticleProcessing(
      article.id,
      finalSummary,
      embedding,
    );

    if (embeddingError) {
      throw new EmbeddingFailedError(embeddingError, summary);
    }

    return summary;
  }

  private async rate(
    article: DBArticle,
    summary: string,
  ): Promise<ImpactRating> {
    const prompts = this.promptsFor(article);
    const ratingPrompt = prompts.impactRating
      ? this.configService.formatPrompt(prompts.impactRating, { summary })
      : this.configService.getImpactRatingPrompt(summary);

    const response = await this.ai.chat(ratingPrompt);
    const scoreMatch = response.trim().match(/\d+/);
    if (!scoreMatch) {
      throw new Error(
        `Could not extract a numeric rating for article ${article.id}`,
      );
    }

    const score = parseInt(scoreMatch[0], 10);
    if (!this.configService.isValidImpactRating(score)) {
      throw new Error(
        `Rating ${score} for article ${article.id} is out of range (1-10)`,
      );
    }

    await this.articlesService.updateArticleRating(article.id, score);
    return score;
  }

  private async categorise(
    article: DBArticle,
    summary: string,
  ): Promise<ArticleCategory[]> {
    const categoryPrompt = this.configService.getCategoryClassificationPrompt(
      article.title,
      summary.substring(0, CATEGORY_CONTENT_LIMIT),
    );

    let response: string | null = null;
    try {
      response = await this.ai.chat(categoryPrompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Category classification call failed: ${message}`);
    }

    const parsed = this.parseCategories(response);
    const categories = parsed.length > 0 ? parsed : [ArticleCategory.OTHER];

    await this.articlesService.updateArticleCategories(article.id, categories);
    return categories;
  }

  private promptsFor(article: DBArticle) {
    return this.profilesService.getPromptsForProfile(
      article.feed_profile as FeedProfile,
    );
  }

  private parseCategories(response: string | null): ArticleCategory[] {
    if (!response) {
      return [];
    }
    try {
      const parsed = JSON.parse(response.trim()) as ArticleCategory[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((cat) =>
        Object.values(ArticleCategory).includes(cat),
      );
    } catch {
      return [];
    }
  }
}
