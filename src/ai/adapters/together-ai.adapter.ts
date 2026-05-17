import OpenAI from 'openai';
import { AiAdapter } from './ai-adapter.interface';

const E5_PATTERNS = [
  /^intfloat\//,
  /^multilingual-e5/,
  /\/e5-/,
  /^e5-[a-z]+$/i,
];

const E5_MAX_CHARS = 800;

export function isE5Model(modelName: string): boolean {
  const normalized = modelName.toLowerCase();
  return E5_PATTERNS.some((p) => p.test(normalized));
}

export function getEmbeddingTokenLimit(modelName: string): number {
  const normalized = modelName.toLowerCase();
  if (normalized.includes('e5')) return 512;
  if (
    normalized.includes('8k') ||
    normalized.includes('nomic-embed-text-v1.5') ||
    normalized.includes('bge-m3')
  ) {
    return 8192;
  }
  return 2048;
}

export class TogetherAiAdapter implements AiAdapter {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  chat(_prompt: string, _systemPrompt?: string, _model?: string): Promise<string> {
    return Promise.reject(new Error('Together.ai does not support chat'));
  }

  async embed(text: string): Promise<number[]> {
    const preparedText = this.prepareInput(text);

    let safeText = preparedText;
    if (isE5Model(this.model) && preparedText.length > E5_MAX_CHARS) {
      safeText = preparedText.substring(0, E5_MAX_CHARS);
    }

    const response = await this.client.embeddings.create({
      model: this.model,
      input: [safeText],
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('Together.ai returned empty embedding response');
    }

    return response.data[0].embedding;
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((t) => this.prepareInput(t));
    const response = await this.client.embeddings.create({
      model: this.model,
      input: inputs,
    });
    return response.data.map((d) => d.embedding);
  }

  generateAudio(_text: string, _voice: string): Promise<Buffer> {
    return Promise.reject(new Error('Together.ai does not support audio generation'));
  }

  private prepareInput(text: string): string {
    const normalized = text.trim().replace(/\s+/g, ' ');
    const usesE5 = isE5Model(this.model);
    const hasPrefix =
      normalized.startsWith('passage:') || normalized.startsWith('query:');
    if (usesE5 && !hasPrefix) {
      return `passage: ${normalized}`;
    }
    return normalized;
  }
}
