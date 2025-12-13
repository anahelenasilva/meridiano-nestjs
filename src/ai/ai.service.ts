import { Injectable, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';
import { ChatMessage } from '../shared/types/ai';

@Injectable()
export class AiService implements OnModuleInit {
  private deepseekClient: OpenAI | null = null;
  private embeddingClient: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients(): void {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const embeddingApiKey = process.env.EMBEDDING_API_KEY;

    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    if (!embeddingApiKey) {
      throw new Error('EMBEDDING_API_KEY not found in environment variables');
    }

    this.deepseekClient = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });

    this.embeddingClient = new OpenAI({
      apiKey: embeddingApiKey,
      baseURL: 'https://api.together.xyz/v1',
    });

    console.log('API clients initialized successfully');
  }

  async callDeepseekChat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string | null> {
    if (!this.deepseekClient) {
      throw new Error(
        'Deepseek client not initialized. Call initializeClients() first.',
      );
    }

    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    try {
      const modelName =
        model || this.configService.getModelConfig().deepseekChatModel;
      const response = await this.deepseekClient.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('Error calling Deepseek Chat API:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return null;
    }
  }

  async getEmbedding(text: string, model?: string): Promise<number[] | null> {
    if (!this.embeddingClient) {
      throw new Error(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    // console.log(
    //   `INFO: Getting embedding for text snippet: '${text.substring(0, 50)}...'`,
    // );

    try {
      const modelName =
        model || this.configService.getModelConfig().embeddingModel;
      const response = await this.embeddingClient.embeddings.create({
        model: modelName,
        input: [text],
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].embedding;
      } else {
        console.warn('Warning: No embedding returned for text.');
        return null;
      }
    } catch (error) {
      console.error('Error calling Embedding API:', error);
      return null;
    }
  }

  async getBatchEmbeddings(
    texts: string[],
    model?: string,
  ): Promise<(number[] | null)[]> {
    if (!this.embeddingClient) {
      throw new Error(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    const results: (number[] | null)[] = [];
    const batchSize = 10;
    const modelName =
      model || this.configService.getModelConfig().embeddingModel;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await this.embeddingClient.embeddings.create({
          model: modelName,
          input: batch,
        });

        batch.forEach((_, index) => {
          if (response.data[index]) {
            results.push(response.data[index].embedding);
          } else {
            results.push(null);
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error getting batch embeddings for batch ${i}:`, error);
        batch.forEach(() => results.push(null));
      }
    }

    return results;
  }

  async testApiConnectivity(): Promise<{
    deepseek: boolean;
    embedding: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deepseekWorking = false;
    let embeddingWorking = false;

    try {
      const testPrompt = 'Respond with "OK" if you can read this.';
      const response = await this.callDeepseekChat(testPrompt);
      deepseekWorking = response !== null;
      if (!deepseekWorking) {
        errors.push('Deepseek API returned null response');
      }
    } catch (error) {
      errors.push(`Deepseek API error: ${error}`);
    }

    try {
      const testText = 'This is a test for embedding API connectivity.';
      const embedding = await this.getEmbedding(testText);
      embeddingWorking = embedding !== null && embedding.length > 0;
      if (!embeddingWorking) {
        errors.push('Embedding API returned null or empty embedding');
      }
    } catch (error) {
      errors.push(`Embedding API error: ${error}`);
    }

    return {
      deepseek: deepseekWorking,
      embedding: embeddingWorking,
      errors,
    };
  }
}
