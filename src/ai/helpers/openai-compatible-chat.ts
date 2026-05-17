import OpenAI from 'openai';
import { sanitizeChatContent } from './sanitize-chat-content';

export async function openaiCompatibleChat(
  client: OpenAI,
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
  maxTokens: number,
  temperature: number,
  adapterName: string,
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: sanitizeChatContent(systemPrompt) });
  }
  messages.push({ role: 'user', content: sanitizeChatContent(prompt) });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`${adapterName} returned empty response`);
  }
  return content;
}
