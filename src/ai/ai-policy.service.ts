import { Logger } from '@nestjs/common';
import { Cause, Effect, Exit, Schedule } from 'effect';
import { averageEmbeddings } from './helpers/average-embeddings';
import { splitTextIntoChunks } from './helpers/split-text-into-chunks';
import { estimateTokenCount } from '../shared/helpers/token-estimation';
import { AiAdapter } from './adapters/ai-adapter.interface';
import { ProviderError, toProviderError } from './provider-error';

const MAX_RETRIES = 2;

// Timeouts are left out: each SDK attempt already waits out the full client
// timeout (600s on OpenAI), so another round multiplies that wait.
const isRetryable = (error: ProviderError) =>
  error._tag === 'RateLimited' || error._tag === 'ProviderUnreachable';

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

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    const chunks = splitTextIntoChunks(text, this.ttsMaxChars);
    const audioBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      audioBuffers.push(
        await this.withRetry(() =>
          this.adapter.generateAudio(chunks[i], voice),
        ),
      );

      if (this.ttsInterChunkDelayMs > 0 && i < chunks.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.ttsInterChunkDelayMs),
        );
      }
    }

    return Buffer.concat(audioBuffers);
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const program = Effect.tryPromise({ try: fn, catch: toProviderError }).pipe(
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
      Effect.mapError((error) => error.cause),
    );

    // runPromise would reject with a FiberFailure wrapper. Callers match on the
    // provider's message, so rethrow the adapter's own error.
    const exit = await Effect.runPromiseExit(program);
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
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
