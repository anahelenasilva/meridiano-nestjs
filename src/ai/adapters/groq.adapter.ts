import Groq from 'groq-sdk';
import { splitTextIntoChunks } from '../helpers/split-text-into-chunks';
import { AiAdapter } from './ai-adapter.interface';

const GROQ_VALID_VOICES = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'];
const GROQ_TTS_MAX_CHARS = 200;

export class GroqAdapter implements AiAdapter {
  constructor(
    private readonly client: Groq,
    private readonly defaultVoice: string,
  ) {}

  chat(_prompt: string, _systemPrompt?: string, _model?: string): Promise<string> {
    return Promise.reject(new Error('Groq does not support chat'));
  }

  embed(_text: string): Promise<number[]> {
    return Promise.reject(new Error('Groq does not support embeddings'));
  }

  async generateAudio(text: string, voice: string): Promise<Buffer> {
    const selectedVoice = GROQ_VALID_VOICES.includes(voice) ? voice : this.defaultVoice;
    const chunks = splitTextIntoChunks(text, GROQ_TTS_MAX_CHARS);
    const audioBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const response = await this.client.audio.speech.create({
          model: 'canopylabs/orpheus-v1-english',
          voice: selectedVoice,
          input: chunk,
          response_format: 'wav',
        });
        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));

        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Groq TTS failed on chunk ${i + 1}/${chunks.length}: ${message}`);
      }
    }

    return Buffer.concat(audioBuffers);
  }
}
