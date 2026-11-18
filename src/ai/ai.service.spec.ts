import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Effect } from 'effect';
import { ConfigService } from '../config/config.service';
import { AiPolicyService } from './ai-policy.service';
import { DeepseekAdapter } from './adapters/deepseek.adapter';
import { GroqAdapter } from './adapters/groq.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AiService } from './ai.service';
import { RateLimited } from './provider-error';

describe('AiService', () => {
  let service: AiService;

  const configService = {
    getModelConfig: jest.fn(() => ({
      embeddingModel: 'text-embedding-3-small',
      deepseekChatModel: 'deepseek-chat',
      openaiChatModel: 'gpt-6-luna',
      openaiTtsVoice: 'alloy',
      groqTtsVoice: 'hannah',
      maxTokens: 2048,
      temperature: 0.7,
    })),
    getEnabledChatModel: jest.fn(() => 'deepseek'),
    getEnabledTtsModel: jest.fn(() => 'openai'),
    getApiKeys: jest.fn(() => ({
      deepseekApiKey: 'test-deepseek-key',
      openaiApiKey: 'test-openai-key',
      groqApiKey: 'test-groq-key',
    })),
  };

  let mockDeepseekAdapter: jest.Mocked<DeepseekAdapter>;
  let mockOpenaiAdapter: jest.Mocked<OpenAIAdapter>;
  let mockGroqAdapter: jest.Mocked<GroqAdapter>;
  let mockChatPolicy: jest.Mocked<AiPolicyService>;
  let mockEmbedPolicy: jest.Mocked<AiPolicyService>;
  let mockOpenaiTtsPolicy: jest.Mocked<AiPolicyService>;
  let mockGroqTtsPolicy: jest.Mocked<AiPolicyService>;

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

    mockOpenaiTtsPolicy = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
    } as any;

    mockGroqTtsPolicy = {
      chat: jest.fn(),
      embed: jest.fn(),
      generateAudio: jest.fn(),
    } as any;

    Object.defineProperty(service, 'deepseekAdapter', {
      value: mockDeepseekAdapter,
      writable: true,
    });
    Object.defineProperty(service, 'openaiAdapter', {
      value: mockOpenaiAdapter,
      writable: true,
    });
    Object.defineProperty(service, 'groqAdapter', {
      value: mockGroqAdapter,
      writable: true,
    });
    Object.defineProperty(service, 'chatPolicyService', {
      value: mockChatPolicy,
      writable: true,
    });
    Object.defineProperty(service, 'embedPolicyService', {
      value: mockEmbedPolicy,
      writable: true,
    });
    Object.defineProperty(service, 'openaiTtsPolicyService', {
      value: mockOpenaiTtsPolicy,
      writable: true,
    });
    Object.defineProperty(service, 'groqTtsPolicyService', {
      value: mockGroqTtsPolicy,
      writable: true,
    });
  });

  afterEach(() => jest.clearAllMocks());

  describe('callChat', () => {
    it('delegates to chatPolicyService and returns result', async () => {
      mockChatPolicy.chat.mockResolvedValue('policy response');

      const result = await service.callChat('prompt', 'model', 'system');

      expect(result).toBe('policy response');
      expect(mockChatPolicy.chat).toHaveBeenCalledWith(
        'prompt',
        'system',
        'model',
      );
    });

    it('returns null and logs on error', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();
      mockChatPolicy.chat.mockRejectedValue(new Error('chat failure'));

      const result = await service.callChat('prompt');

      expect(result).toBeNull();
      loggerSpy.mockRestore();
    });

    it('throws BadRequestException when chatPolicyService is null', async () => {
      Object.defineProperty(service, 'chatPolicyService', {
        value: null,
        writable: true,
      });

      await expect(service.callChat('test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('callChatOrThrow', () => {
    it('delegates to chatPolicyService and returns result', async () => {
      mockChatPolicy.chat.mockResolvedValue('policy response');

      const result = await service.callChatOrThrow('prompt', 'model', 'system');

      expect(result).toBe('policy response');
      expect(mockChatPolicy.chat).toHaveBeenCalledWith(
        'prompt',
        'system',
        'model',
      );
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
      Object.defineProperty(service, 'chatPolicyService', {
        value: null,
        writable: true,
      });

      await expect(service.callChatOrThrow('test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('callChatModelOrThrow', () => {
    // A real init, so the call runs through the provider's own AiPolicyService.
    // Only the adapters' network call is replaced.
    let deepseekChat: jest.SpyInstance;
    let openaiChat: jest.SpyInstance;
    let initialized: AiService;

    beforeEach(async () => {
      deepseekChat = jest.spyOn(DeepseekAdapter.prototype, 'chat');
      openaiChat = jest.spyOn(OpenAIAdapter.prototype, 'chat');
      const mod = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      await mod.init();
      initialized = mod.get(AiService);
    });

    afterEach(() => jest.restoreAllMocks());

    it('sends the prompt to the picked provider, not the enabled one', async () => {
      openaiChat.mockResolvedValue('openai answer');

      const result = await initialized.callChatModelOrThrow(
        'openai',
        'prompt',
        'system',
      );

      expect(result).toBe('openai answer');
      expect(openaiChat).toHaveBeenCalledWith('prompt', 'system', undefined);
      expect(deepseekChat).not.toHaveBeenCalled();
    });

    it('retries a dropped socket like the default chat provider', async () => {
      openaiChat
        .mockRejectedValueOnce(
          Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
        )
        .mockResolvedValueOnce('answer after retry');

      await expect(
        initialized.callChatModelOrThrow('openai', 'prompt'),
      ).resolves.toBe('answer after retry');
      expect(openaiChat).toHaveBeenCalledTimes(2);
    });

    it('throws the provider error instead of returning null', async () => {
      const providerError = new Error('AI chat returned no content');
      deepseekChat.mockRejectedValue(providerError);

      await expect(
        initialized.callChatModelOrThrow('deepseek', 'prompt'),
      ).rejects.toBe(providerError);
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
      Object.defineProperty(service, 'embedPolicyService', {
        value: null,
        writable: true,
      });

      await expect(service.getEmbedding('text')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateAudio', () => {
    const mockBuffer = Buffer.from('audio');

    it('routes to OpenAI when TTS model is openai', async () => {
      configService.getEnabledTtsModel.mockReturnValue('openai');
      mockOpenaiTtsPolicy.generateAudio.mockReturnValue(
        Effect.succeed(mockBuffer),
      );

      const result = await Effect.runPromise(service.generateAudio('Hello'));

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockGroqTtsPolicy.generateAudio).not.toHaveBeenCalled();
    });

    it('routes to Groq when TTS model is groq', async () => {
      configService.getEnabledTtsModel.mockReturnValue('groq');
      mockGroqTtsPolicy.generateAudio.mockReturnValue(
        Effect.succeed(mockBuffer),
      );

      const result = await Effect.runPromise(service.generateAudio('Hello'));

      expect(result).toBe(mockBuffer);
      expect(mockGroqTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockOpenaiTtsPolicy.generateAudio).not.toHaveBeenCalled();
    });

    it('defaults to OpenAI for unknown TTS provider', async () => {
      configService.getEnabledTtsModel.mockReturnValue('unknown' as any);
      mockOpenaiTtsPolicy.generateAudio.mockReturnValue(
        Effect.succeed(mockBuffer),
      );

      await Effect.runPromise(service.generateAudio('Hello'));

      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
    });

    it("passes the policy's typed error through unchanged", async () => {
      configService.getEnabledTtsModel.mockReturnValue('openai');
      const rateLimited = new RateLimited({ cause: new Error('429') });
      mockOpenaiTtsPolicy.generateAudio.mockReturnValue(
        Effect.fail(rateLimited),
      );

      const error = await Effect.runPromise(
        Effect.flip(service.generateAudio('Hello')),
      );

      expect(error).toBe(rateLimited);
    });
  });

  describe('generateOpenAiAudio', () => {
    it('delegates to the OpenAI TTS policy and returns buffer', async () => {
      const mockBuffer = Buffer.from('openai-audio');
      mockOpenaiTtsPolicy.generateAudio.mockReturnValue(
        Effect.succeed(mockBuffer),
      );

      const result = await Effect.runPromise(
        service.generateOpenAiAudio('text', 'nova'),
      );

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledWith(
        'text',
        'nova',
      );
    });

    it('fails with ProviderNotConfigured when the OpenAI TTS policy is null', async () => {
      Object.defineProperty(service, 'openaiTtsPolicyService', {
        value: null,
        writable: true,
      });

      const error = await Effect.runPromise(
        Effect.flip(service.generateOpenAiAudio('text')),
      );

      expect(error._tag).toBe('ProviderNotConfigured');
      expect(error.message).toContain('OpenAI TTS client not initialized');
    });
  });

  describe('generateGroqAudio', () => {
    it('delegates to the Groq TTS policy and returns buffer', async () => {
      const mockBuffer = Buffer.from('groq-audio');
      mockGroqTtsPolicy.generateAudio.mockReturnValue(
        Effect.succeed(mockBuffer),
      );

      const result = await Effect.runPromise(
        service.generateGroqAudio('text', 'troy'),
      );

      expect(result).toBe(mockBuffer);
      expect(mockGroqTtsPolicy.generateAudio).toHaveBeenCalledWith(
        'text',
        'troy',
      );
    });

    it('fails with ProviderNotConfigured when the Groq TTS policy is null', async () => {
      Object.defineProperty(service, 'groqTtsPolicyService', {
        value: null,
        writable: true,
      });

      const error = await Effect.runPromise(
        Effect.flip(service.generateGroqAudio('text')),
      );

      expect(error._tag).toBe('ProviderNotConfigured');
      expect(error.message).toContain('Groq client not initialized');
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
      expect(result.errors).toContain(
        'Embedding API returned null or empty embedding',
      );
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
                embeddingModel: 'text-embedding-3-small',
                deepseekChatModel: 'deepseek-chat',
                openaiChatModel: 'gpt-6-luna',
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
        openaiApiKey: undefined,
        groqApiKey: undefined,
      });
      await expect(mod.init()).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when openaiApiKey is missing', async () => {
      const mod = await makeModule({
        deepseekApiKey: 'ds-key',
        openaiApiKey: undefined,
        groqApiKey: undefined,
      });
      await expect(mod.init()).rejects.toThrow(BadRequestException);
    });

    it('initializes successfully when deepseek and openai keys are present', async () => {
      const mod = await makeModule({
        deepseekApiKey: 'ds-key',
        openaiApiKey: 'openai-key',
        groqApiKey: undefined,
      });
      await expect(mod.init()).resolves.toBeDefined();
    });
  });
});
