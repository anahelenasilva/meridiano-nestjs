import OpenAI from 'openai';
import { openaiCompatibleChat } from '../helpers/openai-compatible-chat';
import { AiAdapter } from './ai-adapter.interface';

export class DeepseekAdapter implements AiAdapter {
  constructor(
    private readonly client: OpenAI,
    private readonly defaultModel: string,
    private readonly maxTokens: number,
    private readonly temperature: number,
  ) {}

  chat(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    return openaiCompatibleChat(
      this.client,
      prompt,
      systemPrompt,
      model ?? this.defaultModel,
      this.maxTokens,
      this.temperature,
      'Deepseek',
    );
  }

  embed(_text: string): Promise<number[]> {
    return Promise.reject(new Error('Deepseek does not support embeddings'));
  }

  generateAudio(_text: string, _voice: string): Promise<Buffer> {
    return Promise.reject(new Error('Deepseek does not support audio generation'));
  }
}
