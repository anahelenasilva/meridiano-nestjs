import { Data } from 'effect';
import { ImpactRating } from '../../shared/types/ai';

export type ProcessingStep = 'summarise' | 'rate' | 'categorise';

const messageOf = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/** `AiAdapter.chat` rejected, after `AiPolicyService` spent its retries. */
export class AiCallFailed extends Data.TaggedError('AiCallFailed')<{
  readonly cause: unknown;
}> {
  override get message() {
    return messageOf(this.cause);
  }
}

/** `ArticlesService` could not persist a step's output. */
export class SaveFailed extends Data.TaggedError('SaveFailed')<{
  readonly cause: unknown;
}> {
  override get message() {
    return messageOf(this.cause);
  }
}

export class SummaryEmpty extends Data.TaggedError('SummaryEmpty')<{
  readonly articleId: string;
}> {
  override get message() {
    return `Summarisation returned no content for article ${this.articleId}`;
  }
}

/**
 * The summary was saved without its embedding. It carries the summary so the
 * failure still reports what the step produced.
 */
export class EmbeddingFailed extends Data.TaggedError('EmbeddingFailed')<{
  readonly summary: string;
  readonly cause: unknown;
}> {
  override get message() {
    return messageOf(this.cause);
  }
}

export class RatingUnparseable extends Data.TaggedError('RatingUnparseable')<{
  readonly articleId: string;
}> {
  override get message() {
    return `Could not extract a numeric rating for article ${this.articleId}`;
  }
}

export class RatingOutOfRange extends Data.TaggedError('RatingOutOfRange')<{
  readonly articleId: string;
  readonly score: number;
}> {
  override get message() {
    return `Rating ${this.score} for article ${this.articleId} is out of range (1-10)`;
  }
}

export type StepError =
  | AiCallFailed
  | SaveFailed
  | SummaryEmpty
  | EmbeddingFailed
  | RatingUnparseable
  | RatingOutOfRange;

/**
 * Failure of `processArticle`. `summary` and `rating` hold what the earlier
 * steps produced; a missing field means that step never completed.
 */
export class ArticleProcessingFailed extends Data.TaggedError(
  'ArticleProcessingFailed',
)<{
  readonly articleId: string;
  readonly step: ProcessingStep;
  readonly reason: StepError;
  readonly summary?: string;
  readonly rating?: ImpactRating;
}> {
  override get message() {
    return `Failed to process article ${this.articleId} at ${this.step} step: ${this.reason.message}`;
  }
}
