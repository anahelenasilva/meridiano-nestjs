import { Inject, Injectable, Logger } from '@nestjs/common';
import { Effect, Either } from 'effect';
import type { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import { ArticleCategory, DBArticle } from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { buildFinalPrompt } from '../../shared/helpers/build-final-prompt';
import { ImpactRating } from '../../shared/types/ai';
import { FeedProfile } from '../../shared/types/feed';
import { AI_ADAPTER } from './ai-adapter.token';
import {
  AiCallFailed,
  ArticleProcessingFailed,
  EmbeddingFailed,
  ProcessingStep,
  RatingOutOfRange,
  RatingUnparseable,
  SaveFailed,
  StepCrashed,
  StepError,
  SummaryEmpty,
} from './processing-errors';
import { PROCESSING_NOTIFIER } from './processing-notifier';
import type { ProcessingNotifier } from './processing-notifier';

const SUMMARY_CONTENT_LIMIT = 4000;
const CATEGORY_CONTENT_LIMIT = 2000;

/**
 * Deep module for the Article Summary -> Impact Rating -> categorisation
 * pipeline. The queue workers run all three steps through `processArticle`; the
 * scheduled briefing run calls `summariseArticle`, `rateArticle` and
 * `categoriseArticle` as separate batch stages. Every entry point returns an
 * Effect for the caller to run, and each step alerts through the notifier once
 * when it fails. It depends on the {@link AiAdapter} interface (never the
 * concrete `AiService`) so it can be unit tested with a fake adapter and no real
 * provider, database, or queue.
 */
@Injectable()
export class ArticleProcessingPipelineService {
  private readonly logger = new Logger(ArticleProcessingPipelineService.name);

  constructor(
    @Inject(AI_ADAPTER) private readonly ai: AiAdapter,
    @Inject(PROCESSING_NOTIFIER)
    private readonly notifier: ProcessingNotifier,
    private readonly articlesService: ArticlesService,
    private readonly configService: ConfigService,
    private readonly profilesService: ProfilesService,
  ) {}

  /** Waits `getArticleProcessingDelayMs()` before each AI step after the first. */
  processArticle(article: DBArticle) {
    return Effect.gen(this, function* () {
      const delayMs = this.configService.getArticleProcessingDelayMs();
      const failed = (
        step: ProcessingStep,
        reason: StepError,
        earlier: { summary?: string; rating?: ImpactRating } = {},
      ) =>
        new ArticleProcessingFailed({
          articleId: article.id,
          step,
          reason,
          ...earlier,
        });

      const summary = yield* this.summariseArticle(article).pipe(
        Effect.mapError((reason) =>
          failed(
            'summarise',
            reason,
            reason._tag === 'EmbeddingFailed'
              ? { summary: reason.summary }
              : {},
          ),
        ),
      );
      yield* Effect.sleep(delayMs);

      const rating = yield* this.rateArticle(article, summary).pipe(
        Effect.mapError((reason) => failed('rate', reason, { summary })),
      );
      yield* Effect.sleep(delayMs);

      const categories = yield* this.categoriseArticle(article, summary).pipe(
        Effect.mapError((reason) =>
          failed('categorise', reason, { summary, rating }),
        ),
      );

      return { summary, rating, categories };
    });
  }

  /**
   * Generates the summary, embeds it, and persists both. The summary is
   * persisted even when embedding fails, but the step still fails with
   * `EmbeddingFailed` so the failure is alerted and counted.
   */
  summariseArticle(article: DBArticle) {
    return this.alertOnFailure(article, 'summarise', this.summarise(article));
  }

  /** Rates `summary`; the batch stage passes the article's saved `processed_content`. */
  rateArticle(article: DBArticle, summary: string) {
    return this.alertOnFailure(article, 'rate', this.rate(article, summary));
  }

  /**
   * Categorises `summary`; the batch stage passes the article's saved
   * `processed_content`. A failed or unparseable AI response falls back to
   * OTHER; only a persistence error fails the step.
   */
  categoriseArticle(article: DBArticle, summary: string) {
    return this.alertOnFailure(
      article,
      'categorise',
      this.categorise(article, summary),
    );
  }

  private alertOnFailure<A, E extends StepError>(
    article: DBArticle,
    step: ProcessingStep,
    effect: Effect.Effect<A, E>,
  ): Effect.Effect<A, E | StepCrashed> {
    const crashAsFailure = Effect.catchAllDefect(effect, (cause) =>
      Effect.fail(new StepCrashed({ cause })),
    );
    return Effect.tapError(crashAsFailure, (error) => {
      this.logger.error(
        `Article ${article.id} failed at ${step} step: ${error.message}`,
      );
      // EmailProcessingNotifier catches its own send errors, so this never rejects.
      return Effect.promise(() =>
        this.notifier.notifyFailure({ article, step, error: error.message }),
      );
    });
  }

  private summarise(article: DBArticle) {
    return Effect.gen(this, function* () {
      const prompts = this.promptsFor(article);
      const articleTitle = article.title || article.feed_source || 'Untitled';
      const content = article.raw_content.substring(0, SUMMARY_CONTENT_LIMIT);

      const baseSummaryPrompt = prompts.articleSummary
        ? this.configService.formatPrompt(prompts.articleSummary, {
            article_content: content,
            article_title: articleTitle,
          })
        : this.configService.getArticleSummaryPrompt(content);

      const summary = yield* this.chat(
        buildFinalPrompt(baseSummaryPrompt, article.custom_prompt),
      );
      if (!summary) {
        return yield* new SummaryEmpty({ articleId: article.id });
      }

      const finalSummary = `${summary}\n\nSource: [${article.title}](${article.url})`;

      const embedding = yield* Effect.tryPromise({
        try: () => this.ai.embed(finalSummary),
        catch: (cause) => new EmbeddingFailed({ summary, cause }),
      }).pipe(
        Effect.filterOrFail(
          (vector) => vector != null,
          () =>
            new EmbeddingFailed({ summary, cause: 'Embedding returned null' }),
        ),
        Effect.either,
      );

      yield* this.save(() =>
        this.articlesService.updateArticleProcessing(
          article.id,
          finalSummary,
          Either.getOrNull(embedding),
        ),
      );
      yield* embedding;

      return summary;
    });
  }

  private rate(article: DBArticle, summary: string) {
    return Effect.gen(this, function* () {
      const prompts = this.promptsFor(article);
      const ratingPrompt = prompts.impactRating
        ? this.configService.formatPrompt(prompts.impactRating, { summary })
        : this.configService.getImpactRatingPrompt(summary);

      const response = yield* this.chat(ratingPrompt);
      const scoreMatch = response.trim().match(/\d+/);
      if (!scoreMatch) {
        return yield* new RatingUnparseable({ articleId: article.id });
      }

      const score = parseInt(scoreMatch[0], 10);
      if (!this.configService.isValidImpactRating(score)) {
        return yield* new RatingOutOfRange({ articleId: article.id, score });
      }

      yield* this.save(() =>
        this.articlesService.updateArticleRating(article.id, score),
      );
      return score;
    });
  }

  private categorise(article: DBArticle, summary: string) {
    return Effect.gen(this, function* () {
      const categoryPrompt = this.configService.getCategoryClassificationPrompt(
        article.title,
        summary.substring(0, CATEGORY_CONTENT_LIMIT),
      );

      const response = yield* this.chat(categoryPrompt).pipe(
        Effect.tapError((error) =>
          Effect.sync(() =>
            this.logger.warn(
              `Category classification call failed: ${error.message}`,
            ),
          ),
        ),
        Effect.orElseSucceed(() => null),
      );

      const parsed = this.parseCategories(response);
      const categories = parsed.length > 0 ? parsed : [ArticleCategory.OTHER];

      yield* this.save(() =>
        this.articlesService.updateArticleCategories(article.id, categories),
      );
      return categories;
    });
  }

  private chat(prompt: string) {
    return Effect.tryPromise({
      try: () => this.ai.chat(prompt),
      catch: (cause) => new AiCallFailed({ cause }),
    });
  }

  private save(write: () => Promise<unknown>) {
    return Effect.tryPromise({
      try: write,
      catch: (cause) => new SaveFailed({ cause }),
    });
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
