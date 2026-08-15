import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { AiPolicyService } from './ai-policy.service';
import { DeepseekAdapter } from './adapters/deepseek.adapter';
import { GroqAdapter } from './adapters/groq.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { TogetherAiAdapter } from './adapters/together-ai.adapter';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  const configService = {
    getModelConfig: jest.fn(() => ({
      embeddingModel: 'intfloat/multilingual-e5-large-instruct',
      deepseekChatModel: 'deepseek-chat',
      openaiChatModel: 'gpt-4o-mini',
      openaiTtsVoice: 'alloy',
      groqTtsVoice: 'hannah',
      maxTokens: 2048,
      temperature: 0.7,
    })),
    getEnabledChatModel: jest.fn(() => 'deepseek'),
    getEnabledTtsModel: jest.fn(() => 'openai'),
    getApiKeys: jest.fn(() => ({
      deepseekApiKey: 'test-deepseek-key',
      embeddingApiKey: 'test-embedding-key',
      openaiApiKey: 'test-openai-key',
      groqApiKey: 'test-groq-key',
    })),
  };

  let mockDeepseekAdapter: jest.Mocked<DeepseekAdapter>;
  let mockOpenaiAdapter: jest.Mocked<OpenAIAdapter>;
  let mockTogetherAiAdapter: jest.Mocked<TogetherAiAdapter>;
  let mockGroqAdapter: jest.Mocked<GroqAdapter>;
  let mockChatPolicy: jest.Mocked<AiPolicyService>;
  let mockEmbedPolicy: jest.Mocked<AiPolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    mockDeepseekAdapter = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
    } as any;

    mockOpenaiAdapter = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
    } as any;

    mockTogetherAiAdapter = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
      batchEmbed: jest.fn(),
    } as any;

    mockGroqAdapter = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
    } as any;

    mockChatPolicy = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
      averageEmbeddings: jest.fn(),
    } as any;

    mockEmbedPolicy = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
      averageEmbeddings: jest.fn(),
    } as any;

    Object.defineProperty(service, 'deepseekAdapter', { value: mockDeepseekAdapter, writable: true });
    Object.defineProperty(service, 'openaiAdapter', { value: mockOpenaiAdapter, writable: true });
    Object.defineProperty(service, 'togetherAiAdapter', { value: mockTogetherAiAdapter, writable: true });
    Object.defineProperty(service, 'groqAdapter', { value: mockGroqAdapter, writable: true });
    Object.defineProperty(service, 'chatPolicyService', { value: mockChatPolicy, writable: true });
    Object.defineProperty(service, 'embedPolicyService', { value: mockEmbedPolicy, writable: true });
  });

  afterEach(() => jest.clearAllMocks());

  describe('callDeepseekChat', () => {
    it('delegates to deepseekAdapter.chat and returns result', async () => {
      mockDeepseekAdapter.chat.mockResolvedValue('deepseek response');

      const result = await service.callDeepseekChat('prompt', 'model', 'system');

      expect(result).toBe('deepseek response');
      expect(mockDeepseekAdapter.chat).toHaveBeenCalledWith('prompt', 'system', 'model');
    });

    it('returns null and logs error when adapter throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDeepseekAdapter.chat.mockRejectedValue(new Error('API failure'));

      const result = await service.callDeepseekChat('prompt');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error calling Deepseek Chat API:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('throws when deepseekAdapter is null', async () => {
      Object.defineProperty(service, 'deepseekAdapter', { value: null, writable: true });

      await expect(service.callDeepseekChat('test')).rejects.toThrow(BadRequestException);
    });
  });

  describe('callOpenAIChat', () => {
    it('delegates to openaiAdapter.chat and returns result', async () => {
      mockOpenaiAdapter.chat.mockResolvedValue('openai response');

      const result = await service.callOpenAIChat('prompt', 'gpt-4', 'system');

      expect(result).toBe('openai response');
      expect(mockOpenaiAdapter.chat).toHaveBeenCalledWith('prompt', 'system', 'gpt-4');
    });

    it('returns null and logs error when adapter throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockOpenaiAdapter.chat.mockRejectedValue(new Error('quota exceeded'));

      const result = await service.callOpenAIChat('prompt');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error calling OpenAI Chat API:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('throws when openaiAdapter is null', async () => {
      Object.defineProperty(service, 'openaiAdapter', { value: null, writable: true });

      await expect(service.callOpenAIChat('test')).rejects.toThrow(BadRequestException);
    });
  });

  describe('callChat', () => {
    it('delegates to chatPolicyService and returns result', async () => {
      mockChatPolicy.chat.mockResolvedValue('policy response');

      const result = await service.callChat('prompt', 'model', 'system');

      expect(result).toBe('policy response');
      expect(mockChatPolicy.chat).toHaveBeenCalledWith('prompt', 'system', 'model');
    });

    it('returns null and logs on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockChatPolicy.chat.mockRejectedValue(new Error('chat failure'));

      const result = await service.callChat('prompt');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('throws BadRequestException when chatPolicyService is null', async () => {
      Object.defineProperty(service, 'chatPolicyService', { value: null, writable: true });

      await expect(service.callChat('test')).rejects.toThrow(BadRequestException);
    });
  });

  describe('callChatOrThrow', () => {
    it('delegates to chatPolicyService and returns result', async () => {
      mockChatPolicy.chat.mockResolvedValue('policy response');

      const result = await service.callChatOrThrow('prompt', 'model', 'system');

      expect(result).toBe('policy response');
      expect(mockChatPolicy.chat).toHaveBeenCalledWith('prompt', 'system', 'model');
    });

    it('propagates the provider error verbatim, preserving finish_reason', async () => {
      const providerError = new Error(
        'AI chat returned no content (finish_reason=length)',
      );
      mockChatPolicy.chat.mockRejectedValue(providerError);

      await expect(service.callChatOrThrow('prompt')).rejects.toBe(
        providerError,
      );
      await expect(service.callChatOrThrow('prompt')).rejects.toThrow(
        'finish_reason=length',
      );
    });

    it('throws BadRequestException when chatPolicyService is null', async () => {
      Object.defineProperty(service, 'chatPolicyService', { value: null, writable: true });

      await expect(service.callChatOrThrow('test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getEmbedding', () => {
    it('delegates to embedPolicyService and returns result', async () => {
      mockEmbedPolicy.embed.mockResolvedValue([0.1, 0.2]);

      const result = await service.getEmbedding('some text');

      expect(result).toEqual([0.1, 0.2]);
      expect(mockEmbedPolicy.embed).toHaveBeenCalledWith('some text');
    });

    it('returns null when policy returns null', async () => {
      mockEmbedPolicy.embed.mockResolvedValue(null);

      const result = await service.getEmbedding('');

      expect(result).toBeNull();
    });

    it('propagates error when policy throws', async () => {
      mockEmbedPolicy.embed.mockRejectedValue(new Error('auth error'));

      await expect(service.getEmbedding('text')).rejects.toThrow('auth error');
    });

    it('throws when embedPolicyService is null', async () => {
      Object.defineProperty(service, 'embedPolicyService', { value: null, writable: true });

      await expect(service.getEmbedding('text')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBatchEmbeddings', () => {
    it('batches short inputs in a single request', async () => {
      mockTogetherAiAdapter.batchEmbed.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);

      const results = await service.getBatchEmbeddings(['first', 'second']);

      expect(results).toEqual([[0.1, 0.2], [0.3, 0.4]]);
      expect(mockTogetherAiAdapter.batchEmbed).toHaveBeenCalledTimes(1);
    });

    it('falls back to per-item embedding when batch fails', async () => {
      mockTogetherAiAdapter.batchEmbed.mockRejectedValue(new Error('batch failure'));
      mockEmbedPolicy.embed
        .mockResolvedValueOnce([5, 6])
        .mockResolvedValueOnce([7, 8]);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const results = await service.getBatchEmbeddings(['alpha', 'beta']);

      expect(results).toEqual([[5, 6], [7, 8]]);
      consoleSpy.mockRestore();
    });

    it('uses per-item embedding for long inputs', async () => {
      const longText = 'Long sentence for embeddings. '.repeat(300);
      mockTogetherAiAdapter.batchEmbed.mockResolvedValue([[10, 20]]);
      mockEmbedPolicy.embed.mockResolvedValue([2, 2]);

      const results = await service.getBatchEmbeddings(['short', longText]);

      expect(results[0]).toEqual([10, 20]);
      expect(results[1]).toEqual([2, 2]);
      expect(mockEmbedPolicy.embed).toHaveBeenCalledWith(longText);
    });

    it('throws when adapters are null', async () => {
      Object.defineProperty(service, 'togetherAiAdapter', { value: null, writable: true });

      await expect(service.getBatchEmbeddings(['text'])).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateAudio', () => {
    const mockBuffer = Buffer.from('audio');

    it('routes to OpenAI when TTS model is openai', async () => {
      configService.getEnabledTtsModel.mockReturnValue('openai');
      mockOpenaiAdapter.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateAudio('Hello');

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiAdapter.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockGroqAdapter.generateAudio).not.toHaveBeenCalled();
    });

    it('routes to Groq when TTS model is groq', async () => {
      configService.getEnabledTtsModel.mockReturnValue('groq');
      mockGroqAdapter.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateAudio('Hello');

      expect(result).toBe(mockBuffer);
      expect(mockGroqAdapter.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockOpenaiAdapter.generateAudio).not.toHaveBeenCalled();
    });

    it('defaults to OpenAI for unknown TTS provider', async () => {
      configService.getEnabledTtsModel.mockReturnValue('unknown' as any);
      mockOpenaiAdapter.generateAudio.mockResolvedValue(mockBuffer);

      await service.generateAudio('Hello');

      expect(mockOpenaiAdapter.generateAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateOpenAiAudio', () => {
    it('delegates to openaiAdapter and returns buffer', async () => {
      const mockBuffer = Buffer.from('openai-audio');
      mockOpenaiAdapter.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateOpenAiAudio('text', 'nova');

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiAdapter.generateAudio).toHaveBeenCalledWith('text', 'nova');
    });

    it('throws when openaiAdapter is null', async () => {
      Object.defineProperty(service, 'openaiAdapter', { value: null, writable: true });

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS client not initialized',
      );
    });

    it('wraps adapter error with descriptive message', async () => {
      mockOpenaiAdapter.generateAudio.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS failed: quota exceeded',
      );
    });
  });

  describe('generateGroqAudio', () => {
    it('delegates to groqAdapter and returns buffer', async () => {
      const mockBuffer = Buffer.from('groq-audio');
      mockGroqAdapter.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateGroqAudio('text', 'troy');

      expect(result).toBe(mockBuffer);
      expect(mockGroqAdapter.generateAudio).toHaveBeenCalledWith('text', 'troy');
    });

    it('throws when groqAdapter is null', async () => {
      Object.defineProperty(service, 'groqAdapter', { value: null, writable: true });

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq client not initialized',
      );
    });

    it('rethrows Groq TTS failed errors unchanged', async () => {
      mockGroqAdapter.generateAudio.mockRejectedValue(
        new Error('Groq TTS failed on chunk 1/1: service down'),
      );

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq TTS failed on chunk 1/1: service down',
      );
    });

    it('wraps other errors with Groq TTS failed prefix', async () => {
      mockGroqAdapter.generateAudio.mockRejectedValue(new Error('unknown error'));

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq TTS failed: unknown error',
      );
    });
  });

  describe('testApiConnectivity', () => {
    it('returns both true when all APIs respond', async () => {
      mockDeepseekAdapter.chat.mockResolvedValue('OK');
      mockEmbedPolicy.embed.mockResolvedValue([0.1, 0.2]);

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(true);
      expect(result.embedding).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports deepseek failure when adapter throws', async () => {
      mockDeepseekAdapter.chat.mockRejectedValue(new Error('deepseek down'));
      mockEmbedPolicy.embed.mockResolvedValue([0.1]);

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(false);
      expect(result.embedding).toBe(true);
      expect(result.errors[0]).toContain('Deepseek API error');
    });

    it('reports embedding failure when policy returns null', async () => {
      mockDeepseekAdapter.chat.mockResolvedValue('OK');
      mockEmbedPolicy.embed.mockResolvedValue(null);

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(true);
      expect(result.embedding).toBe(false);
      expect(result.errors).toContain('Embedding API returned null or empty embedding');
    });

    it('handles total failure when both throw', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDeepseekAdapter.chat.mockRejectedValue(new Error('deepseek down'));
      mockEmbedPolicy.embed.mockRejectedValue(new Error('embed down'));

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(false);
      expect(result.embedding).toBe(false);
      expect(result.errors).toHaveLength(2);
      consoleSpy.mockRestore();
    });
  });

  describe('initializeClients', () => {
    const makeModule = (apiKeys: Record<string, string | undefined>) =>
      Test.createTestingModule({
        providers: [
          AiService,
          {
            provide: ConfigService,
            useValue: {
              getModelConfig: jest.fn(() => ({
                embeddingModel: 'intfloat/multilingual-e5-large-instruct',
                deepseekChatModel: 'deepseek-chat',
                openaiChatModel: 'gpt-4o-mini',
                openaiTtsVoice: 'alloy',
                groqTtsVoice: 'hannah',
                maxTokens: 2048,
                temperature: 0.7,
              })),
              getEnabledChatModel: jest.fn(() => 'deepseek'),
              getEnabledTtsModel: jest.fn(() => 'openai'),
              getApiKeys: jest.fn(() => apiKeys),
            },
          },
        ],
      }).compile();

    it('throws BadRequestException when deepseekApiKey is missing', async () => {
      const mod = await makeModule({
        deepseekApiKey: undefined,
        embeddingApiKey: 'emb-key',
        openaiApiKey: undefined,
        groqApiKey: undefined,
      });
      await expect(mod.init()).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when embeddingApiKey is missing', async () => {
      const mod = await makeModule({
        deepseekApiKey: 'ds-key',
        embeddingApiKey: undefined,
        openaiApiKey: undefined,
        groqApiKey: undefined,
      });
      await expect(mod.init()).rejects.toThrow(BadRequestException);
    });

    it('initializes successfully when required keys are present', async () => {
      const mod = await makeModule({
        deepseekApiKey: 'ds-key',
        embeddingApiKey: 'emb-key',
        openaiApiKey: undefined,
        groqApiKey: undefined,
      });
      await expect(mod.init()).resolves.toBeDefined();
    });
  });
});
