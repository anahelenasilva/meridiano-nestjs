import { estimateTokenCount } from '../shared/helpers/token-estimation';
import { AiAdapter } from './adapters/ai-adapter.interface';

const RETRYABLE_PATTERNS = ['429', 'rate', 'timeout', 'ECONN', 'ETIMEDOUT', 'ECONNRESET'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export class AiPolicyService {
  constructor(
    private readonly adapter: AiAdapter,
    private readonly embeddingChunkTokenLimit: number = 256,
  ) {}

  async chat(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    return this.withRetry(() => this.adapter.chat(prompt, systemPrompt, model));
  }

  async embed(text: string): Promise<number[] | null> {
    if (!text || !text.trim()) {
      console.warn('Empty or whitespace-only text provided to embed');
      return null;
    }

    const chunks = this.splitTextByEstimatedTokens(
      text.trim().replace(/\s+/g, ' '),
      this.embeddingChunkTokenLimit,
    );

    if (chunks.length === 0) return null;

    const vectors: number[][] = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const vector = await this.withRetry(() => this.adapter.embed(chunks[i]));
        vectors.push(vector);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `Warning: Failed to get embedding for chunk ${i + 1}/${chunks.length} after ${MAX_RETRIES} retries: ${message}`,
        );
      }
    }

    if (vectors.length === 0) {
      console.warn('Warning: No embedding returned for text.');
      return null;
    }

    return this.averageEmbeddings(vectors);
  }

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    return this.adapter.generateAudio(text, voice);
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (!this.isRetryable(message)) {
          console.error(`Non-retryable error: ${message}`);
          throw error;
        }

        lastError = error;
        if (attempt < MAX_RETRIES) {
          console.warn(`Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }

  private isRetryable(message: string): boolean {
    return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
  }

  private splitTextByEstimatedTokens(text: string, maxTokens: number): string[] {
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

  private splitSentenceIntoWordChunks(sentence: string, maxTokens: number): string[] {
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

  averageEmbeddings(embeddings: number[][]): number[] {
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Cannot average empty embeddings array');
    }

    const vectorSize = embeddings[0].length;
    const sums = new Array<number>(vectorSize).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < vectorSize; i++) {
        sums[i] += embedding[i];
      }
    }

    return sums.map((sum) => sum / embeddings.length);
  }
}
