import { ArticleCategory } from '../../articles/article.entity';
import { ImpactRating } from '../../shared/types/ai';

export type ProcessingStep = 'summarise' | 'rate' | 'categorise';

export interface ProcessingSuccess {
  success: true;
  summary: string;
  rating: ImpactRating;
  categories: ArticleCategory[];
}

/**
 * A failure carries whatever earlier steps produced so callers (and tests) can
 * see, e.g., that summarise succeeded even though rate failed. Missing fields
 * mean that step never completed.
 */
export interface ProcessingFailure {
  success: false;
  failedStep: ProcessingStep;
  error: string;
  summary?: string;
  rating?: ImpactRating;
}

export type ProcessingResult = ProcessingSuccess | ProcessingFailure;
