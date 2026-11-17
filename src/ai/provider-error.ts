import { Data } from 'effect';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

export class RateLimited extends Data.TaggedError('RateLimited')<{
  readonly cause: unknown;
}> {}

export class ProviderUnreachable extends Data.TaggedError(
  'ProviderUnreachable',
)<{
  readonly cause: unknown;
}> {}

export class ProviderTimeout extends Data.TaggedError('ProviderTimeout')<{
  readonly cause: unknown;
}> {}

/** A 5xx after the SDK's own retries: the request was fine, the provider was not. */
export class ProviderUnavailable extends Data.TaggedError(
  'ProviderUnavailable',
)<{
  readonly cause: unknown;
}> {}

export class ProviderRejected extends Data.TaggedError('ProviderRejected')<{
  readonly cause: unknown;
}> {}

export type ProviderError =
  | RateLimited
  | ProviderUnreachable
  | ProviderTimeout
  | ProviderUnavailable
  | ProviderRejected;

/** No client for the chosen provider, because its API key is unset. */
export class ProviderNotConfigured extends Data.TaggedError(
  'ProviderNotConfigured',
)<{
  readonly message: string;
}> {}

export function toProviderError(error: unknown): ProviderError {
  // Timeout first: APIConnectionTimeoutError extends APIConnectionError.
  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof Groq.APIConnectionTimeoutError
  ) {
    return new ProviderTimeout({ cause: error });
  }
  if (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof Groq.APIConnectionError
  ) {
    return new ProviderUnreachable({ cause: error });
  }
  if (
    error instanceof OpenAI.RateLimitError ||
    error instanceof Groq.RateLimitError
  ) {
    return new RateLimited({ cause: error });
  }
  if (
    error instanceof OpenAI.InternalServerError ||
    error instanceof Groq.InternalServerError
  ) {
    return new ProviderUnavailable({ cause: error });
  }
  return new ProviderRejected({ cause: error });
}
