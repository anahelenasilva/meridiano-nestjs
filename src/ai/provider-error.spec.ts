import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { toProviderError } from './provider-error';

describe('toProviderError', () => {
  it.each([
    [
      'OpenAI 429',
      'RateLimited',
      new OpenAI.RateLimitError(
        429,
        undefined,
        'Rate limit reached',
        undefined,
      ),
    ],
    [
      'Groq 429',
      'RateLimited',
      new Groq.RateLimitError(429, undefined, 'Rate limit reached', {}),
    ],
    [
      'OpenAI connection error',
      'ProviderUnreachable',
      new OpenAI.APIConnectionError({ message: 'Connection error.' }),
    ],
    [
      'Groq connection error',
      'ProviderUnreachable',
      new Groq.APIConnectionError({ message: 'Connection error.' }),
    ],
    [
      'socket dropped while reading the response body',
      'ProviderUnreachable',
      Object.assign(
        new Error(
          'Invalid response body while trying to fetch https://api.openai.com/v1/audio/speech: socket hang up',
        ),
        { code: 'ECONNRESET' },
      ),
    ],
    [
      'OpenAI timeout',
      'ProviderTimeout',
      new OpenAI.APIConnectionTimeoutError(),
    ],
    ['Groq timeout', 'ProviderTimeout', new Groq.APIConnectionTimeoutError()],
    [
      'OpenAI 500',
      'ProviderUnavailable',
      new OpenAI.InternalServerError(
        500,
        undefined,
        'Internal server error',
        undefined,
      ),
    ],
    [
      'Groq 503',
      'ProviderUnavailable',
      new Groq.InternalServerError(503, undefined, 'Service Unavailable', {}),
    ],
    [
      'OpenAI 400',
      'ProviderRejected',
      new OpenAI.BadRequestError(
        400,
        undefined,
        'Unable to access model',
        undefined,
      ),
    ],
    [
      'plain Error that mentions a rate limit',
      'ProviderRejected',
      new Error('rate limit 429'),
    ],
  ])('classifies %s as %s', (_label, tag, error) => {
    expect(toProviderError(error)._tag).toBe(tag);
  });

  it('keeps the original error as the cause', () => {
    const error = new Error('boom');
    expect(toProviderError(error).cause).toBe(error);
  });
});
