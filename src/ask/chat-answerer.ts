import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type { Answerer, AnswerInput, AskTurn } from './answerer';

const SYSTEM_PROMPT = `You answer questions about one source: an article or a video transcript.
Rules:
- Answer only from the source text you are given. Do not use outside knowledge.
- If the source text does not answer the question, say so plainly instead of guessing.
- Answer in the language the question is written in, whatever the language of the source.
- Quote or point to the relevant passage when it helps the reader check the answer.
- Format the answer as markdown.`;

/**
 * v1 answerer: one prompt with the whole source text, sent to the chat
 * provider the owner picked through `callChatModelOrThrow`, so retries apply
 * and a provider failure reaches `AskService` as an error.
 */
@Injectable()
export class ChatAnswerer implements Answerer {
  constructor(private readonly aiService: AiService) {}

  answer(input: AnswerInput): Promise<string> {
    return this.aiService.callChatModelOrThrow(
      input.model,
      buildPrompt(input),
      SYSTEM_PROMPT,
    );
  }
}

function buildPrompt({
  sourceTitle,
  sourceText,
  history,
  question,
}: AnswerInput): string {
  const turns = history.map(formatTurn).join('\n\n');
  return [
    `<source title="${sourceTitle}">\n${sourceText}\n</source>`,
    turns && `<earlier_turns>\n${turns}\n</earlier_turns>`,
    `<question>\n${question}\n</question>`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatTurn({ question, answer }: AskTurn): string {
  return `Q: ${question}\nA: ${answer}`;
}
