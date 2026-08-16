import Groq from 'groq-sdk';
import { AiAdapter } from './ai-adapter.interface';

const GROQ_VALID_VOICES = [
  'autumn',
  'diana',
  'hannah',
  'austin',
  'daniel',
  'troy',
];

// Orpheus caps a single TTS request at 200 chars; AiPolicyService chunks to fit.
export const GROQ_TTS_MAX_CHARS = 200;
// Orpheus rate-limits rapid successive requests; pace multi-chunk audio.
export const GROQ_TTS_INTER_CHUNK_DELAY_MS = 100;
const GROQ_TTS_MODEL = 'canopylabs/orpheus-v1-english';

export class GroqAdapter implements AiAdapter {
  constructor(
    private readonly client: Groq,
    private readonly defaultVoice: string,
  ) {}

  chat(
    _prompt: string,
    _systemPrompt?: string,
    _model?: string,
  ): Promise<string> {
    return Promise.reject(new Error('Groq does not support chat'));
  }

  embed(_text: string): Promise<number[]> {
    return Promise.reject(new Error('Groq does not support embeddings'));
  }

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    const selectedVoice = GROQ_VALID_VOICES.includes(voice)
      ? voice
      : this.defaultVoice;
    const response = await this.client.audio.speech.create({
      model: GROQ_TTS_MODEL,
      voice: selectedVoice,
      input: text,
      response_format: 'wav',
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
