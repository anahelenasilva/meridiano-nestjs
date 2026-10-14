import OpenAI from 'openai';
import { sanitizeChatContent } from './sanitize-chat-content';

export async function openaiCompatibleChat(
  client: OpenAI,
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
  adapterName: string,
  // Providers disagree on the token cap and sampling fields, so each adapter
  // supplies them.
  providerParams: Record<string, unknown>,
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: sanitizeChatContent(systemPrompt),
    });
  }
  messages.push({ role: 'user', content: sanitizeChatContent(prompt) });

  const response = await client.chat.completions.create({
    model,
    messages,
    ...providerParams,
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

  const choice = response.choices[0];
  const content = choice?.message?.content?.trim();
  if (!content) {
    // finish_reason distinguishes budget exhaustion (`length` -> reasoning
    // models spend max_tokens on CoT, leaving no content) from a genuine
    // empty completion. Without it this fault is undiagnosable from logs.
    throw new Error(
      `${adapterName} returned empty response (finish_reason=${choice?.finish_reason})`,
    );
  }
  return content;
}
