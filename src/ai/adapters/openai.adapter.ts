import OpenAI from 'openai';
import { openaiCompatibleChat } from '../helpers/openai-compatible-chat';
import { splitTextIntoChunks } from '../helpers/split-text-into-chunks';
import { AiAdapter } from './ai-adapter.interface';

const OPENAI_VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const OPENAI_TTS_MAX_CHARS = 4096;

export class OpenAIAdapter implements AiAdapter {
  constructor(
    private readonly chatClient: OpenAI,
    private readonly ttsClient: OpenAI,
    private readonly defaultChatModel: string,
    private readonly maxTokens: number,
    private readonly temperature: number,
    private readonly defaultVoice: string,
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

  embed(_text: string): Promise<number[]> {
    return Promise.reject(new Error('Use TogetherAiAdapter for embeddings'));
  }

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    const selectedVoice = OPENAI_VALID_VOICES.includes(voice as typeof OPENAI_VALID_VOICES[number])
      ? voice
      : this.defaultVoice;

    const chunks = splitTextIntoChunks(text, OPENAI_TTS_MAX_CHARS);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const response = await this.ttsClient.audio.speech.create({
        model: 'tts-1',
        voice: selectedVoice as typeof OPENAI_VALID_VOICES[number],
        input: chunk,
        response_format: 'mp3',
      });
      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    return Buffer.concat(audioBuffers);
  }
}
