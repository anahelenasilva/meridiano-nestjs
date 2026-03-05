import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';
import { ChatMessage } from '../shared/types/ai';

@Injectable()
export class AiService implements OnModuleInit {
  private deepseekClient: OpenAI | null = null;
  private embeddingClient: OpenAI | null = null;
  private openaiTtsClient: OpenAI | null = null;
  private openaiChatClient: OpenAI | null = null;
  private groqClient: Groq | null = null;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients(): void {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const embeddingApiKey = process.env.EMBEDDING_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

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

    this.deepseekClient = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });

    this.embeddingClient = new OpenAI({
      apiKey: embeddingApiKey,
      baseURL: 'https://api.together.xyz/v1',
    });

    const enabledChatModel = this.configService.getEnabledChatModel();

    if (openaiApiKey) {
      this.openaiTtsClient = new OpenAI({
        apiKey: openaiApiKey,
      });

      this.openaiChatClient = new OpenAI({
        apiKey: openaiApiKey,
      });

      console.log('OpenAI TTS and Chat clients initialized successfully');
    } else if (enabledChatModel === 'openai') {
      // Fail fast if OpenAI chat model is enabled but API key is missing
      throw new BadRequestException(
        'Configuration error: ENABLED_CHAT_MODEL is set to "openai" but OPENAI_API_KEY is not defined. ' +
        'Please set the OPENAI_API_KEY environment variable or change ENABLED_CHAT_MODEL to "deepseek".',
      );
    } else {
      console.warn(
        'OPENAI_API_KEY not found in environment variables. TTS and OpenAI chat functionality will not be available.',
      );
    }

    // Initialize Groq client for TTS
    if (groqApiKey) {
      this.groqClient = new Groq({
        apiKey: groqApiKey,
      });
      console.log('Groq TTS client initialized successfully');
    } else {
      console.warn(
        'GROQ_API_KEY not found in environment variables. Groq TTS functionality will not be available.',
      );
    }

    console.log('API clients initialized successfully');
  }

  async callDeepseekChat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string | null> {
    if (!this.deepseekClient) {
      throw new BadRequestException(
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
      const config = this.configService.getModelConfig();
      const response = await this.deepseekClient.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      return response.choices[0]?.message?.content?.trim() || null;
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
    if (!this.openaiChatClient) {
      throw new BadRequestException(
        'OpenAI chat client not initialized. OPENAI_API_KEY may be missing.',
      );
    }

    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    try {
      const modelName =
        model || this.configService.getModelConfig().openaiChatModel;
      const config = this.configService.getModelConfig();
      const response = await this.openaiChatClient.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      return response.choices[0]?.message?.content?.trim() || null;
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
    const enabledProvider = this.configService.getEnabledChatModel();

    switch (enabledProvider) {
      case 'openai':
        return this.callOpenAIChat(prompt, model, systemPrompt);
      case 'deepseek':
      default:
        return this.callDeepseekChat(prompt, model, systemPrompt);
    }
  }

  async getEmbedding(text: string, model?: string): Promise<number[] | null> {
    if (!this.embeddingClient) {
      throw new BadRequestException(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    if (!text || !text.trim()) {
      console.warn('Empty or whitespace-only text provided to getEmbedding');
      return null;
    }

    try {
      const modelName = this.resolveEmbeddingModel(model);
      const tokenLimit = this.getModelTokenLimit(modelName);
      // Use more conservative limit for E5 models (512 token max)
      const isE5 = this.isE5Model(modelName);
      const safetyFactor = isE5 ? 0.5 : 0.75;
      const safeChunkTokenLimit = Math.max(64, Math.floor(tokenLimit * safetyFactor));
      
      // Prepare input after calculating limits to properly account for prefix
      const safeInput = this.prepareEmbeddingInput(text, modelName);
      const chunks = this.splitTextByEstimatedTokens(
        safeInput,
        safeChunkTokenLimit,
      );

      if (chunks.length === 0) {
        return null;
      }

      const vectors: number[][] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let embedding: number[] | null = null;
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries && !embedding) {
          try {
            embedding = await this.getSingleEmbedding(chunk, modelName);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Only retry on retriable errors (rate limits, timeouts, connection issues)
            const isRetryable =
              errorMessage.includes('429') ||
              errorMessage.includes('rate') ||
              errorMessage.includes('timeout') ||
              errorMessage.includes('ECONN') ||
              errorMessage.includes('ETIMEDOUT') ||
              errorMessage.includes('ECONNRESET');

            if (!isRetryable) {
              // Don't retry on authentication or invalid request errors
              console.error(
                `Chunk ${i + 1}/${chunks.length} failed with non-retryable error: ${errorMessage}`,
              );
              break;
            }

            retries++;
            if (retries <= maxRetries) {
              console.warn(
                `Chunk ${i + 1}/${chunks.length} failed, retrying (${retries}/${maxRetries})...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        if (embedding) {
          vectors.push(embedding);
        } else {
          console.warn(`Warning: Failed to get embedding for chunk ${i + 1}/${chunks.length} after ${maxRetries} retries.`);
        }
      }

      if (vectors.length === 0) {
        console.warn('Warning: No embedding returned for text.');
        return null;
      }

      return this.averageEmbeddings(vectors);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Error calling Embedding API for text (${text.length} chars) with model ${model || 'default'}: ${errorMessage}`,
      );
      return null;
    }
  }

  async getBatchEmbeddings(
    texts: string[],
    model?: string,
  ): Promise<(number[] | null)[]> {
    if (!this.embeddingClient) {
      throw new BadRequestException(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const modelName = this.resolveEmbeddingModel(model);
    const tokenLimit = this.getModelTokenLimit(modelName);
    const isE5 = this.isE5Model(modelName);
    const safetyFactor = isE5 ? 0.5 : 0.75;
    const safeChunkTokenLimit = Math.max(64, Math.floor(tokenLimit * safetyFactor));
    const batchSize = 10;
    const shortInputs: Array<{ index: number; input: string; original: string }> = [];
    const longInputs: Array<{ index: number; original: string }> = [];

    texts.forEach((text, index) => {
      const preparedInput = this.prepareEmbeddingInput(text, modelName);
      if (this.estimateTokenCount(preparedInput) <= safeChunkTokenLimit) {
        shortInputs.push({ index, input: preparedInput, original: text });
        return;
      }

      longInputs.push({ index, original: text });
    });

    for (let i = 0; i < shortInputs.length; i += batchSize) {
      const batch = shortInputs.slice(i, i + batchSize);
      try {
        const response = await this.embeddingClient.embeddings.create({
          model: modelName,
          input: batch.map((item) => item.input),
        });

        batch.forEach((item, itemIndex) => {
          const embedding = response.data[itemIndex]?.embedding ?? null;
          results[item.index] = embedding;
        });
      } catch (error) {
        console.error(
          `Error getting batch embeddings for batch ${i} (model: ${modelName}, items: ${batch.length}):`,
          error,
        );

        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          results[item.index] = await this.getEmbedding(item.original, modelName);

          // Add delay to avoid rate limiting on fallback calls
          if (j < batch.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
    }

    for (const item of longInputs) {
      results[item.index] = await this.getEmbedding(item.original, modelName);
    }

    return results;
  }

  private resolveEmbeddingModel(model?: string): string {
    return model || this.configService.getModelConfig().embeddingModel;
  }

  private prepareEmbeddingInput(text: string, modelName: string): string {
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    const usesE5Model = this.isE5Model(modelName);
    const hasInstructionPrefix =
      normalizedText.startsWith('passage:') ||
      normalizedText.startsWith('query:');

    if (usesE5Model && !hasInstructionPrefix) {
      return `passage: ${normalizedText}`;
    }

    return normalizedText;
  }

  private isE5Model(modelName: string): boolean {
    const normalized = modelName.toLowerCase();
    // Explicit E5 model family detection - require model path prefix or exact match
    // to avoid false positives with model names containing 'e5' (e.g., "fake-e5-model")
    const e5Patterns = [
      /^intfloat\//, // intfloat/* models (the E5 family)
      /^multilingual-e5/, // multilingual-e5-* models
      /\/e5-/, // any */e5-* pattern
      /^e5-[a-z]+$/i, // e5-large, e5-small, e5-base (standalone)
    ];
    return e5Patterns.some((pattern) => pattern.test(normalized));
  }

  private getModelTokenLimit(modelName: string): number {
    const normalizedModel = modelName.toLowerCase();

    if (normalizedModel.includes('e5')) {
      return 512;
    }

    if (
      normalizedModel.includes('8k') ||
      normalizedModel.includes('nomic-embed-text-v1.5') ||
      normalizedModel.includes('bge-m3')
    ) {
      return 8192;
    }

    return 2048;
  }

  private splitTextByEstimatedTokens(text: string, maxTokens: number): string[] {
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    if (!normalizedText) {
      return [];
    }

    if (this.estimateTokenCount(normalizedText) <= maxTokens) {
      return [normalizedText];
    }

    const sentences = normalizedText.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

      if (this.estimateTokenCount(candidate) <= maxTokens) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (this.estimateTokenCount(sentence) <= maxTokens) {
        currentChunk = sentence;
        continue;
      }

      const wordChunks = this.splitSentenceIntoWordChunks(sentence, maxTokens);
      chunks.push(...wordChunks.slice(0, -1));
      currentChunk = wordChunks[wordChunks.length - 1] || '';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitSentenceIntoWordChunks(
    sentence: string,
    maxTokens: number,
  ): string[] {
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const candidate = currentChunk ? `${currentChunk} ${word}` : word;
      if (this.estimateTokenCount(candidate) <= maxTokens) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        // Safety check: if a single word exceeds maxTokens, truncate it
        if (this.estimateTokenCount(word) > maxTokens) {
          // Truncate word to safe length and add as its own chunk
          const safeLength = Math.floor(maxTokens * 3); // Approx 3 chars per token
          const truncatedWord = word.substring(0, safeLength);
          chunks.push(truncatedWord);
          currentChunk = '';
        } else {
          currentChunk = word;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private estimateTokenCount(text: string): number {
    // Conservative token estimation for embedding models
    // Embedding models (especially E5) are more sensitive to token limits
    if (!text || text.length === 0) {
      return 0;
    }

    // Method 1: Character-based (most conservative for non-English/large tokens)
    // Average 2-4 chars per token, use 2.5 for safety margin
    const charEstimate = Math.ceil(text.length / 2.5);

    // Method 2: Word-based with padding for punctuation
    const words = text.trim().split(/\s+/).length;
    const punctuationMatches = text.match(/[.,!?;:"'()[\]{}]/g);
    const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
    const wordEstimate = words + Math.ceil(punctuationCount * 0.5);

    // Use the MORE conservative estimate
    return Math.max(charEstimate, wordEstimate);
  }

  private async getSingleEmbedding(
    text: string,
    modelName: string,
  ): Promise<number[] | null> {
    if (!this.embeddingClient) {
      throw new BadRequestException(
        'Embedding client not initialized. Call initializeClients() first.',
      );
    }

    // Hard safety: truncate if still too long after chunking
    let safeText = text;
    
    // For E5 models, be extra conservative - truncate to ~400 tokens worth of chars
    if (this.isE5Model(modelName)) {
      const maxChars = 800; // ~400 tokens at 2 chars/token average
      if (text.length > maxChars) {
        safeText = text.substring(0, maxChars);
      }
    }

    const response = await this.embeddingClient.embeddings.create({
      model: modelName,
      input: [safeText],
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    return response.data[0].embedding;
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    if (!embeddings || embeddings.length === 0) {
      throw new BadRequestException('Cannot average empty embeddings array');
    }

    const vectorSize = embeddings[0].length;
    const sums = new Array<number>(vectorSize).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < vectorSize; i += 1) {
        sums[i] += embedding[i];
      }
    }

    return sums.map((sum) => sum / embeddings.length);
  }

  async generateAudio(text: string, voice?: string): Promise<Buffer> {
    const enabledTtsModel = this.configService.getEnabledTtsModel();

    switch (enabledTtsModel) {
      case 'groq':
        return this.generateGroqAudio(text, voice);
      case 'openai':
      default:
        return this.generateOpenAiAudio(text, voice);
    }
  }

  async generateOpenAiAudio(
    text: string,
    voice?: string,
  ): Promise<Buffer> {
    if (!this.openaiTtsClient) {
      throw new Error(
        'OpenAI TTS client not initialized. OPENAI_API_KEY may be missing.',
      );
    }

    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const modelConfig = this.configService.getModelConfig();
    const selectedVoice =
      voice && validVoices.includes(voice) ? voice : modelConfig.openaiTtsVoice;

    const maxCharsPerChunk = 4096;

    try {
      const chunks = this.splitTextIntoChunks(text, maxCharsPerChunk);
      const audioBuffers: Buffer[] = [];

      for (const chunk of chunks) {
        const response = await this.openaiTtsClient.audio.speech.create({
          model: 'tts-1',
          voice: selectedVoice as
            | 'alloy'
            | 'echo'
            | 'fable'
            | 'onyx'
            | 'nova'
            | 'shimmer',
          input: chunk,
          response_format: 'mp3',
        });

        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
      }

      return Buffer.concat(audioBuffers);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI TTS failed: ${message}`);
    }
  }

  async generateGroqAudio(
    text: string,
    voice?: string,
  ): Promise<Buffer> {
    if (!this.groqClient) {
      throw new Error(
        'Groq client not initialized. GROQ_API_KEY may be missing.',
      );
    }

    const validVoices = [
      'autumn',
      'diana',
      'hannah',
      'austin',
      'daniel',
      'troy',
    ];
    const modelConfig = this.configService.getModelConfig();
    const selectedVoice =
      voice && validVoices.includes(voice) ? voice : modelConfig.groqTtsVoice;

    const maxCharsPerChunk = 200;

    try {
      const chunks = this.splitTextIntoChunks(text, maxCharsPerChunk);
      console.log(
        `Splitting text into ${chunks.length} chunks for Groq TTS (limit: ${maxCharsPerChunk} chars per chunk)`,
      );

      const audioBuffers: Buffer[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const response = await this.groqClient.audio.speech.create({
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
        } catch (chunkError) {
          const message = chunkError instanceof Error ? chunkError.message : String(chunkError);
          throw new Error(`Groq TTS failed on chunk ${i + 1}/${chunks.length}: ${message}`);
        }
      }

      return Buffer.concat(audioBuffers);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Groq TTS failed')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Groq TTS failed: ${message}`);
    }
  }

  /**
   * Splits text into chunks of specified maximum size.
   * Tries to split at sentence boundaries when possible.
   */
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > maxChunkSize) {
      // Find the last sentence boundary within the chunk size
      let splitIndex = remainingText.lastIndexOf('. ', maxChunkSize);

      // If no sentence boundary found, try other punctuation
      if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
        splitIndex = remainingText.lastIndexOf(' ', maxChunkSize);
      }

      // If still no good split point, force split at maxChunkSize
      if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
        splitIndex = maxChunkSize;
      }

      // Add the chunk (including the period if we split on a sentence)
      let chunk = remainingText.substring(0, splitIndex + 1).trim();
      if (
        !chunk.endsWith('.') &&
        !chunk.endsWith('!') &&
        !chunk.endsWith('?')
      ) {
        chunk = remainingText.substring(0, splitIndex).trim();
      }

      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      remainingText = remainingText.substring(chunk.length).trim();
    }

    // Add remaining text as the last chunk
    if (remainingText.length > 0) {
      chunks.push(remainingText);
    }

    return chunks;
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
