import OpenAI from 'openai';
import { sanitizeChatContent } from '../helpers/sanitize-chat-content';
import { AiAdapter } from './ai-adapter.interface';

export class DeepseekAdapter implements AiAdapter {
  constructor(
    private readonly client: OpenAI,
    private readonly defaultModel: string,
    private readonly maxTokens: number,
    private readonly temperature: number,
  ) {}

  async chat(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: sanitizeChatContent(systemPrompt) });
    }
    messages.push({ role: 'user', content: sanitizeChatContent(prompt) });

    const response = await this.client.chat.completions.create({
      model: model || this.defaultModel,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Deepseek returned empty response');
    }
    return content;
  }

  embed(_text: string): Promise<number[]> {
    return Promise.reject(new Error('Deepseek does not support embeddings'));
  }

  generateAudio(_text: string, _voice: string): Promise<Buffer> {
    return Promise.reject(new Error('Deepseek does not support audio generation'));
  }
}
