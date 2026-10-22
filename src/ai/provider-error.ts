import * as Data from 'effect/Data';
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

export class ProviderRejected extends Data.TaggedError('ProviderRejected')<{
  readonly cause: unknown;
}> {}

export type ProviderError =
  | RateLimited
  | ProviderUnreachable
  | ProviderTimeout
  | ProviderRejected;

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
  return new ProviderRejected({ cause: error });
}
