import { Logger } from '@nestjs/common';
import { Effect, Schedule } from 'effect';
import { averageEmbeddings } from './helpers/average-embeddings';
import { splitTextIntoChunks } from './helpers/split-text-into-chunks';
import { estimateTokenCount } from '../shared/helpers/token-estimation';
import { AiAdapter } from './adapters/ai-adapter.interface';
import {
  isSocketError,
  ProviderError,
  toProviderError,
} from './provider-error';
import { runPromiseOrThrow } from './run-effect';

const MAX_RETRIES = 2;

// The SDK clients already retry 408, 409, 429, 5xx, timeouts and connection
// errors twice, honouring retry-after. A socket that drops while the body is
// read fails after the SDK has returned, so it is the only error left to retry.
const isRetryable = (error: ProviderError) =>
  error._tag === 'ProviderUnreachable' && isSocketError(error.cause);

const retryPolicy = {
  schedule: Schedule.exponential('500 millis').pipe(Schedule.jittered),
  times: MAX_RETRIES,
  while: isRetryable,
};

export class AiPolicyService {
  private readonly logger = new Logger(AiPolicyService.name);

  constructor(
    private readonly adapter: AiAdapter,
    private readonly embeddingChunkTokenLimit: number = 256,
    private readonly ttsMaxChars: number = 4096,
    // Proactive pause between TTS chunk calls; guards providers that rate-limit
    // rapid successive requests (e.g. Groq/Orpheus). 0 = fire back-to-back.
    private readonly ttsInterChunkDelayMs: number = 0,
  ) {}

  async chat(
    prompt: string,
    systemPrompt?: string,
    model?: string,
  ): Promise<string> {
    return this.withRetry(() => this.adapter.chat(prompt, systemPrompt, model));
  }

  async embed(text: string): Promise<number[] | null> {
    if (!text || !text.trim()) {
      this.logger.warn('Empty or whitespace-only text provided to embed');
      return null;
    }

    const chunks = this.splitTextByEstimatedTokens(
      text.trim().replace(/\s+/g, ' '),
      this.embeddingChunkTokenLimit,
    );

    if (chunks.length === 0) return null;

    const vectors: number[][] = [];
    let lastError: unknown;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const vector = await this.withRetry(() =>
          this.adapter.embed(chunks[i]),
        );
        vectors.push(vector);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to get embedding for chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES} retries: ${message}`,
        );
      }
    }

    if (vectors.length === 0) {
      // Returning null here hid the provider's 400 from the failure email.
      const message =
        lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Embedding failed for all ${chunks.length} chunk(s): ${message}`,
      );
    }

    return averageEmbeddings(vectors);
  }

  /**
   * Fails with the typed {@link ProviderError} instead of rejecting, so a
   * caller such as the audio worker can decide what to retry by tag.
   */
  generateAudio(
    text: string,
    voice: string,
  ): Effect.Effect<Buffer, ProviderError> {
    const chunks = splitTextIntoChunks(text, this.ttsMaxChars);
    const pause =
      this.ttsInterChunkDelayMs > 0
        ? Effect.sleep(this.ttsInterChunkDelayMs)
        : Effect.void;

    return Effect.forEach(chunks, (chunk, i) =>
      this.retrying(() => this.adapter.generateAudio(chunk, voice)).pipe(
        Effect.tap(() => (i < chunks.length - 1 ? pause : Effect.void)),
      ),
    ).pipe(Effect.map((buffers) => Buffer.concat(buffers)));
  }

  // Rejects with the adapter's own error: callers match on the provider's message.
  private withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return runPromiseOrThrow(
      this.retrying(fn).pipe(Effect.mapError((error) => error.cause)),
    );
  }

  private retrying<T>(fn: () => Promise<T>): Effect.Effect<T, ProviderError> {
    return Effect.tryPromise({ try: fn, catch: toProviderError }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          const cause = error.cause;
          const message =
            cause instanceof Error ? cause.message : String(cause);
          const line = `AI provider call failed (${error._tag}): ${message}`;
          if (isRetryable(error)) {
            this.logger.warn(line);
          } else {
            this.logger.error(line);
          }
        }),
      ),
      Effect.retry(retryPolicy),
    );
  }

  private splitTextByEstimatedTokens(
    text: string,
    maxTokens: number,
  ): string[] {
    if (!text) return [];

    if (estimateTokenCount(text) <= maxTokens) {
      return [text];
    }

    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

      if (estimateTokenCount(candidate) <= maxTokens) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (estimateTokenCount(sentence) <= maxTokens) {
        currentChunk = sentence;
        continue;
      }

      const wordChunks = this.splitSentenceIntoWordChunks(sentence, maxTokens);
      chunks.push(...wordChunks.slice(0, -1));
      currentChunk = wordChunks[wordChunks.length - 1] || '';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitSentenceIntoWordChunks(
    sentence: string,
    maxTokens: number,
  ): string[] {
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const candidate = currentChunk ? `${currentChunk} ${word}` : word;

      if (estimateTokenCount(candidate) <= maxTokens) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (estimateTokenCount(word) > maxTokens) {
        chunks.push(word.substring(0, Math.floor(maxTokens * 3)));
        currentChunk = '';
      } else {
        currentChunk = word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
