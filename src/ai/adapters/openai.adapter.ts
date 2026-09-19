import OpenAI from 'openai';
import { openaiCompatibleChat } from '../helpers/openai-compatible-chat';
import { AiAdapter } from './ai-adapter.interface';

const OPENAI_VALID_VOICES = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
] as const;

// OpenAI TTS caps a single request at 4096 chars; AiPolicyService chunks to fit.
export const OPENAI_TTS_MAX_CHARS = 4096;

// text-embedding-3-* rejects inputs over 8191 tokens; AiPolicyService chunks below it.
export const OPENAI_EMBEDDING_MAX_TOKENS = 8191;

export class OpenAIAdapter implements AiAdapter {
  constructor(
    private readonly chatClient: OpenAI,
    private readonly ttsClient: OpenAI,
    private readonly defaultChatModel: string,
    private readonly maxTokens: number,
    private readonly temperature: number,
    private readonly defaultVoice: string,
    private readonly embeddingModel: string,
  ) {}

  chat(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    return openaiCompatibleChat(
      this.chatClient,
      prompt,
      systemPrompt,
      model ?? this.defaultChatModel,
      this.maxTokens,
      this.temperature,
      'OpenAI',
    );
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.chatClient.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error(
        `OpenAI returned no embedding for model ${this.embeddingModel}`,
      );
    }
    return embedding;
  }

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    const selectedVoice = OPENAI_VALID_VOICES.includes(
      voice as (typeof OPENAI_VALID_VOICES)[number],
    )
      ? voice
      : this.defaultVoice;

    const response = await this.ttsClient.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice as (typeof OPENAI_VALID_VOICES)[number],
      input: text,
      response_format: 'mp3',
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
