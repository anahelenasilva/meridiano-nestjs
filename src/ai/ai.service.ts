import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';
import { estimateTokenCount } from '../shared/helpers/token-estimation';
import { AiPolicyService } from './ai-policy.service';
import { DeepseekAdapter } from './adapters/deepseek.adapter';
import { GroqAdapter } from './adapters/groq.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import {
  TogetherAiAdapter,
  getEmbeddingTokenLimit,
  isE5Model,
} from './adapters/together-ai.adapter';

@Injectable()
export class AiService implements OnModuleInit {
  private deepseekAdapter: DeepseekAdapter | null = null;
  private openaiAdapter: OpenAIAdapter | null = null;
  private togetherAiAdapter: TogetherAiAdapter | null = null;
  private groqAdapter: GroqAdapter | null = null;

  private chatPolicyService: AiPolicyService | null = null;
  private embedPolicyService: AiPolicyService | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients(): void {
    const { deepseekApiKey, embeddingApiKey, openaiApiKey, groqApiKey } =
      this.configService.getApiKeys();

    if (!deepseekApiKey) {
      throw new BadRequestException(
        'DEEPSEEK_API_KEY not found in environment variables',
      );
    }

    if (!embeddingApiKey) {
      throw new BadRequestException(
        'EMBEDDING_API_KEY not found in environment variables',
      );
    }

    const config = this.configService.getModelConfig();
    const enabledChatModel = this.configService.getEnabledChatModel();

    const deepseekClient = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    this.deepseekAdapter = new DeepseekAdapter(
      deepseekClient,
      config.deepseekChatModel,
      config.maxTokens,
      config.temperature,
    );

    const embeddingClient = new OpenAI({
      apiKey: embeddingApiKey,
      baseURL: 'https://api.together.xyz/v1',
    });
    this.togetherAiAdapter = new TogetherAiAdapter(embeddingClient, config.embeddingModel);

    const isE5 = isE5Model(config.embeddingModel);
    const tokenLimit = getEmbeddingTokenLimit(config.embeddingModel);
    const safetyFactor = isE5 ? 0.5 : 0.75;
    const chunkTokenLimit = Math.max(64, Math.floor(tokenLimit * safetyFactor));
    this.embedPolicyService = new AiPolicyService(this.togetherAiAdapter, chunkTokenLimit);

    if (openaiApiKey) {
      const openaiChatClient = new OpenAI({ apiKey: openaiApiKey });
      const openaiTtsClient = new OpenAI({ apiKey: openaiApiKey });
      this.openaiAdapter = new OpenAIAdapter(
        openaiChatClient,
        openaiTtsClient,
        config.openaiChatModel,
        config.maxTokens,
        config.temperature,
        config.openaiTtsVoice,
      );
      console.log('OpenAI TTS and Chat clients initialized successfully');
    } else if (enabledChatModel === 'openai') {
      throw new BadRequestException(
        'Configuration error: ENABLED_CHAT_MODEL is set to "openai" but OPENAI_API_KEY is not defined. ' +
        'Please set the OPENAI_API_KEY environment variable or change ENABLED_CHAT_MODEL to "deepseek".',
      );
    } else {
      console.warn(
        'OPENAI_API_KEY not found in environment variables. TTS and OpenAI chat functionality will not be available.',
      );
    }

    if (groqApiKey) {
      this.groqAdapter = new GroqAdapter(
        new Groq({ apiKey: groqApiKey }),
        config.groqTtsVoice,
      );
      console.log('Groq TTS client initialized successfully');
    } else {
      console.warn(
        'GROQ_API_KEY not found in environment variables. Groq TTS functionality will not be available.',
      );
    }

    const chatAdapter = enabledChatModel === 'openai' && this.openaiAdapter
      ? this.openaiAdapter
      : this.deepseekAdapter;
    this.chatPolicyService = new AiPolicyService(chatAdapter);

    console.log('API clients initialized successfully');
  }

  async callDeepseekChat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string | null> {
    if (!this.deepseekAdapter) {
      throw new BadRequestException(
        'Deepseek client not initialized. Call initializeClients() first.',
      );
    }
    try {
      return await this.deepseekAdapter.chat(prompt, systemPrompt, model);
    } catch (error) {
      console.error('Error calling Deepseek Chat API:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return null;
    }
  }

  async callOpenAIChat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string | null> {
    if (!this.openaiAdapter) {
      throw new BadRequestException(
        'OpenAI chat client not initialized. OPENAI_API_KEY may be missing.',
      );
    }
    try {
      return await this.openaiAdapter.chat(prompt, systemPrompt, model);
    } catch (error) {
      console.error('Error calling OpenAI Chat API:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return null;
    }
  }

  async callChat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string | null> {
    if (!this.chatPolicyService) {
      throw new BadRequestException('Chat service not initialized.');
    }
    try {
      return await this.chatPolicyService.chat(prompt, systemPrompt, model);
    } catch (error) {
      console.error('Error calling Chat API:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return null;
    }
  }

  async getEmbedding(text: string, _model?: string): Promise<number[] | null> {
    if (!this.embedPolicyService) {
      throw new BadRequestException(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }
    try {
      return await this.embedPolicyService.embed(text);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Error calling Embedding API for text (${text.length} chars): ${errorMessage}`,
      );
      return null;
    }
  }

  async getBatchEmbeddings(
    texts: string[],
    _model?: string,
  ): Promise<(number[] | null)[]> {
    if (!this.togetherAiAdapter || !this.embedPolicyService) {
      throw new BadRequestException(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    const config = this.configService.getModelConfig();
    const modelName = config.embeddingModel;
    const isE5 = isE5Model(modelName);
    const tokenLimit = getEmbeddingTokenLimit(modelName);
    const safetyFactor = isE5 ? 0.5 : 0.75;
    const chunkTokenLimit = Math.max(64, Math.floor(tokenLimit * safetyFactor));

    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const batchSize = 10;
    const shortInputs: Array<{ index: number; original: string }> = [];
    const longInputs: Array<{ index: number; original: string }> = [];

    texts.forEach((text, index) => {
      const normalized = (text || '').trim().replace(/\s+/g, ' ');
      const prepared = isE5 && !normalized.startsWith('passage:') && !normalized.startsWith('query:')
        ? `passage: ${normalized}`
        : normalized;

      if (estimateTokenCount(prepared) <= chunkTokenLimit) {
        shortInputs.push({ index, original: text });
      } else {
        longInputs.push({ index, original: text });
      }
    });

    for (let i = 0; i < shortInputs.length; i += batchSize) {
      const batch = shortInputs.slice(i, i + batchSize);
      try {
        const embeddings = await this.togetherAiAdapter.batchEmbed(
          batch.map((item) => item.original),
        );
        batch.forEach((item, itemIndex) => {
          results[item.index] = embeddings[itemIndex] ?? null;
        });
      } catch (error) {
        console.error(
          `Error getting batch embeddings for batch ${i} (items: ${batch.length}):`,
          error,
        );
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          results[item.index] = await this.embedPolicyService!.embed(item.original);
          if (j < batch.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
    }

    for (const item of longInputs) {
      results[item.index] = await this.embedPolicyService!.embed(item.original);
    }

    return results;
  }

  async generateAudio(text: string, voice?: string): Promise<Buffer> {
    const enabledTtsModel = this.configService.getEnabledTtsModel();
    const selectedVoice = voice || '';

    switch (enabledTtsModel) {
      case 'groq':
        return this.generateGroqAudio(text, selectedVoice);
      case 'openai':
      default:
        return this.generateOpenAiAudio(text, selectedVoice);
    }
  }

  async generateOpenAiAudio(text: string, voice?: string): Promise<Buffer> {
    if (!this.openaiAdapter) {
      throw new Error(
        'OpenAI TTS client not initialized. OPENAI_API_KEY may be missing.',
      );
    }
    try {
      return await this.openaiAdapter.generateAudio(text, voice || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI TTS failed: ${message}`);
    }
  }

  async generateGroqAudio(text: string, voice?: string): Promise<Buffer> {
    if (!this.groqAdapter) {
      throw new Error(
        'Groq client not initialized. GROQ_API_KEY may be missing.',
      );
    }
    try {
      return await this.groqAdapter.generateAudio(text, voice || '');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Groq TTS failed')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Groq TTS failed: ${message}`);
    }
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
      if (!this.deepseekAdapter) throw new Error('Deepseek adapter not initialized');
      const response = await this.deepseekAdapter.chat('Respond with "OK" if you can read this.');
      deepseekWorking = !!response;
      if (!deepseekWorking) {
        errors.push('Deepseek API returned null response');
      }
    } catch (error) {
      errors.push(`Deepseek API error: ${error}`);
    }

    try {
      if (!this.embedPolicyService) throw new Error('Embedding adapter not initialized');
      const embedding = await this.embedPolicyService.embed('This is a test for embedding API connectivity.');
      embeddingWorking = Array.isArray(embedding) && embedding.length > 0;
      if (!embeddingWorking) {
        errors.push('Embedding API returned null or empty embedding');
      }
    } catch (error) {
      errors.push(`Embedding API error: ${error}`);
    }

    return { deepseek: deepseekWorking, embedding: embeddingWorking, errors };
  }
}
