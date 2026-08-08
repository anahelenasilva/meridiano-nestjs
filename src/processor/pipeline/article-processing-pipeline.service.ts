import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import {
  ArticleCategory,
  DBArticle,
} from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { buildFinalPrompt } from '../../shared/helpers/build-final-prompt';
import { ImpactRating } from '../../shared/types/ai';
import { FeedProfile } from '../../shared/types/feed';
import { AI_ADAPTER } from './ai-adapter.token';
import { PROCESSING_NOTIFIER } from './processing-notifier';
import type { ProcessingNotifier } from './processing-notifier';
import { ProcessingResult, ProcessingStep } from './processing-result';
import { SLEEPER } from './sleeper';
import type { Sleeper } from './sleeper';

const SUMMARY_CONTENT_LIMIT = 4000;
const CATEGORY_CONTENT_LIMIT = 2000;

/**
 * Signals that a pipeline step failed. Carries the step identity and any output
 * earlier steps already produced so the caller's failure result keeps it.
 */
class PipelineStepError extends Error {
  constructor(
    readonly step: ProcessingStep,
    message: string,
    readonly partial: { summary?: string; rating?: ImpactRating } = {},
  ) {
    super(message);
    this.name = 'PipelineStepError';
  }
}

/**
 * Deep module for the Article Summary -> Impact Rating -> categorisation
 * pipeline. `processArticle` is the only public entry point; the three steps,
 * failure notification, and rate-limiting delay are internal. It depends on the
 * {@link AiAdapter} interface (never the concrete `AiService`) so it can be unit
 * tested with a fake adapter and no real provider, database, or queue.
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

    let summary: string | undefined;
    let rating: ImpactRating | undefined;

    try {
      summary = await this.summarise(article);
      await this.sleeper.sleep(delayMs);

      rating = await this.rate(article, summary);
      await this.sleeper.sleep(delayMs);

      const categories = await this.categorise(article, summary);

      return { success: true, summary, rating, categories };
    } catch (error) {
      const step: ProcessingStep =
        error instanceof PipelineStepError ? error.step : 'summarise';
      const message =
        error instanceof Error ? error.message : String(error);

      if (error instanceof PipelineStepError) {
        summary = error.partial.summary ?? summary;
        rating = error.partial.rating ?? rating;
      }

      this.logger.error(
        `Article ${article.id} failed at ${step} step: ${message}`,
      );
      await this.notifier.notifyFailure({ article, step, error: message });

      return { success: false, failedStep: step, error: message, summary, rating };
    }
  }

  /**
   * Generates the summary, embeds it, and persists both. Persisting the summary
   * even when embedding fails preserves prior behaviour: the summary is not lost,
   * but the article still counts as failed so the job is retried.
   */
  private async summarise(article: DBArticle): Promise<string> {
    const prompts = this.profilesService.getPromptsForProfile(
      article.feed_profile as FeedProfile,
    );
    const articleTitle = article.title || article.feed_source || 'Untitled';

    const baseSummaryPrompt = prompts.articleSummary
      ? this.configService.formatPrompt(prompts.articleSummary, {
          article_content: article.raw_content.substring(0, SUMMARY_CONTENT_LIMIT),
          article_title: articleTitle,
        })
      : this.configService.getArticleSummaryPrompt(
          article.raw_content.substring(0, SUMMARY_CONTENT_LIMIT),
        );

    const summaryPrompt = buildFinalPrompt(
      baseSummaryPrompt,
      article.custom_prompt,
    );

    const summary = await this.callChat(summaryPrompt, 'summarise');
    if (!summary) {
      throw new PipelineStepError(
        'summarise',
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
      // Summary is persisted; surface the embedding failure while keeping it.
      throw new PipelineStepError('summarise', embeddingError, { summary });
    }

    return summary;
  }

  private async rate(article: DBArticle, summary: string): Promise<ImpactRating> {
    const prompts = this.profilesService.getPromptsForProfile(
      article.feed_profile as FeedProfile,
    );

    const ratingPrompt = prompts.impactRating
      ? this.configService.formatPrompt(prompts.impactRating, { summary })
      : this.configService.getImpactRatingPrompt(summary);

    const response = await this.callChat(ratingPrompt, 'rate');
    const scoreMatch = response?.trim().match(/\d+/);
    if (!scoreMatch) {
      throw new PipelineStepError(
        'rate',
        `Could not extract a numeric rating for article ${article.id}`,
        { summary },
      );
    }

    const score = parseInt(scoreMatch[0], 10);
    if (!this.configService.isValidImpactRating(score)) {
      throw new PipelineStepError(
        'rate',
        `Rating ${score} for article ${article.id} is out of range (1-10)`,
        { summary },
      );
    }

    await this.articlesService.updateArticleRating(article.id, score);
    return score;
  }

  /**
   * Assigns categories. Mirrors prior behaviour: a missing/unparseable AI
   * response falls back to OTHER rather than failing the article; only a
   * persistence error fails the step.
   */
  private async categorise(
    article: DBArticle,
    summary: string,
  ): Promise<ArticleCategory[]> {
    const categoryPrompt = this.configService.getCategoryClassificationPrompt(
      article.title,
      summary.substring(0, CATEGORY_CONTENT_LIMIT),
    );

    let categories: ArticleCategory[] = [ArticleCategory.OTHER];
    let response: string | null = null;
    try {
      response = await this.callChat(categoryPrompt, 'categorise');
    } catch {
      response = null;
    }

    const parsed = this.parseCategories(response);
    if (parsed.length > 0) {
      categories = parsed;
    }

    try {
      await this.articlesService.updateArticleCategories(article.id, categories);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PipelineStepError('categorise', message, { summary });
    }

    return categories;
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

  /**
   * Normalises adapter behaviour to the pipeline's needs: a null return means
   * "no content" for callers to branch on, while a genuine adapter throw during
   * a hard step surfaces as a step failure.
   */
  private async callChat(
    prompt: string,
    step: ProcessingStep,
  ): Promise<string | null> {
    try {
      return await this.ai.chat(prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (step === 'categorise') {
        // Categorisation tolerates a failed call and falls back to OTHER.
        this.logger.warn(`Category classification call failed: ${message}`);
        return null;
      }
      throw new PipelineStepError(step, message);
    }
  }
}
