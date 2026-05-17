export interface AiAdapter {
  chat(prompt: string, systemPrompt?: string, model?: string): Promise<string>;
  embed(text: string): Promise<number[]>;
  generateAudio(text: string, voice: string): Promise<Buffer>;
}
