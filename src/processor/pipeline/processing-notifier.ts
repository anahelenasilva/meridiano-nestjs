import { DBArticle } from '../../articles/article.entity';
import { ProcessingStep } from './processing-result';

export const PROCESSING_NOTIFIER = Symbol('PROCESSING_NOTIFIER');

export interface ProcessingFailureNotification {
  article: DBArticle;
  step: ProcessingStep;
  error: string;
}

/**
 * Seam that hides how processing failures are reported. Callers of the pipeline
 * receive a typed failure result and never learn that email is involved; tests
 * inject a fake to assert notification without a real transport.
 */
export interface ProcessingNotifier {
  notifyFailure(notification: ProcessingFailureNotification): Promise<void>;
}
