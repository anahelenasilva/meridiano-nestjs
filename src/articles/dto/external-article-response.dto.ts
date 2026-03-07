export interface ExternalArticleSuccessResponse {
  success: true;
  jobId: string;
  articleId: string;
  message: string;
}

export interface ExternalArticleErrorResponse {
  success: false;
  error: {
    code: ExternalArticleErrorCode;
    message: string;
    retryAfter?: number;
  };
}

export type ExternalArticleResponse = ExternalArticleSuccessResponse | ExternalArticleErrorResponse;

export enum ExternalArticleErrorCode {
  INVALID_URL = 'INVALID_URL',
  INVALID_FEED_PROFILE = 'INVALID_FEED_PROFILE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  ARTICLE_EXISTS = 'ARTICLE_EXISTS',
  SCRAPE_FAILED = 'SCRAPE_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const EXTERNAL_ERROR_MESSAGES: Record<ExternalArticleErrorCode, string> = {
  [ExternalArticleErrorCode.INVALID_URL]: "The URL you provided doesn't seem valid. Please check and try again.",
  [ExternalArticleErrorCode.INVALID_FEED_PROFILE]: 'Invalid feed profile. Use one of: technology, politics, business, health, science, brasil, teclas',
  [ExternalArticleErrorCode.UNAUTHORIZED]: 'Authentication error. Please contact support.',
  [ExternalArticleErrorCode.RATE_LIMIT_EXCEEDED]: "You're submitting too fast. Please wait a minute.",
  [ExternalArticleErrorCode.ARTICLE_EXISTS]: 'This article has already been submitted before.',
  [ExternalArticleErrorCode.SCRAPE_FAILED]: "Couldn't access the article. Is the URL correct and accessible?",
  [ExternalArticleErrorCode.INTERNAL_ERROR]: 'Something went wrong on our end. Please try again later.',
};
