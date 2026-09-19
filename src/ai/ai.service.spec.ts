import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { AiPolicyService } from './ai-policy.service';
import { DeepseekAdapter } from './adapters/deepseek.adapter';
import { GroqAdapter } from './adapters/groq.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  const configService = {
    getModelConfig: jest.fn(() => ({
      embeddingModel: 'text-embedding-3-small',
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

  describe('callDeepseekChat', () => {
    it('delegates to deepseekAdapter.chat and returns result', async () => {
      mockDeepseekAdapter.chat.mockResolvedValue('deepseek response');

      const result = await service.callDeepseekChat(
        'prompt',
        'model',
        'system',
      );

      expect(result).toBe('deepseek response');
      expect(mockDeepseekAdapter.chat).toHaveBeenCalledWith(
        'prompt',
        'system',
        'model',
      );
    });

    it('returns null and logs error when adapter throws', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();
      mockDeepseekAdapter.chat.mockRejectedValue(new Error('API failure'));

      const result = await service.callDeepseekChat('prompt');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error calling Deepseek Chat API',
        expect.any(String),
      );
      loggerSpy.mockRestore();
    });

    it('throws when deepseekAdapter is null', async () => {
      Object.defineProperty(service, 'deepseekAdapter', {
        value: null,
        writable: true,
      });

      await expect(service.callDeepseekChat('test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('callOpenAIChat', () => {
    it('delegates to openaiAdapter.chat and returns result', async () => {
      mockOpenaiAdapter.chat.mockResolvedValue('openai response');

      const result = await service.callOpenAIChat('prompt', 'gpt-4', 'system');

      expect(result).toBe('openai response');
      expect(mockOpenaiAdapter.chat).toHaveBeenCalledWith(
        'prompt',
        'system',
        'gpt-4',
      );
    });

    it('returns null and logs error when adapter throws', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();
      mockOpenaiAdapter.chat.mockRejectedValue(new Error('quota exceeded'));

      const result = await service.callOpenAIChat('prompt');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error calling OpenAI Chat API',
        expect.any(String),
      );
      loggerSpy.mockRestore();
    });

    it('throws when openaiAdapter is null', async () => {
      Object.defineProperty(service, 'openaiAdapter', {
        value: null,
        writable: true,
      });

      await expect(service.callOpenAIChat('test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

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
      mockOpenaiTtsPolicy.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateAudio('Hello');

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockGroqTtsPolicy.generateAudio).not.toHaveBeenCalled();
    });

    it('routes to Groq when TTS model is groq', async () => {
      configService.getEnabledTtsModel.mockReturnValue('groq');
      mockGroqTtsPolicy.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateAudio('Hello');

      expect(result).toBe(mockBuffer);
      expect(mockGroqTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
      expect(mockOpenaiTtsPolicy.generateAudio).not.toHaveBeenCalled();
    });

    it('defaults to OpenAI for unknown TTS provider', async () => {
      configService.getEnabledTtsModel.mockReturnValue('unknown' as any);
      mockOpenaiTtsPolicy.generateAudio.mockResolvedValue(mockBuffer);

      await service.generateAudio('Hello');

      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateOpenAiAudio', () => {
    it('delegates to the OpenAI TTS policy and returns buffer', async () => {
      const mockBuffer = Buffer.from('openai-audio');
      mockOpenaiTtsPolicy.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateOpenAiAudio('text', 'nova');

      expect(result).toBe(mockBuffer);
      expect(mockOpenaiTtsPolicy.generateAudio).toHaveBeenCalledWith(
        'text',
        'nova',
      );
    });

    it('throws when the OpenAI TTS policy is null', async () => {
      Object.defineProperty(service, 'openaiTtsPolicyService', {
        value: null,
        writable: true,
      });

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS client not initialized',
      );
    });

    it('wraps policy error with descriptive message', async () => {
      mockOpenaiTtsPolicy.generateAudio.mockRejectedValue(
        new Error('quota exceeded'),
      );

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS failed: quota exceeded',
      );
    });
  });

  describe('generateGroqAudio', () => {
    it('delegates to the Groq TTS policy and returns buffer', async () => {
      const mockBuffer = Buffer.from('groq-audio');
      mockGroqTtsPolicy.generateAudio.mockResolvedValue(mockBuffer);

      const result = await service.generateGroqAudio('text', 'troy');

      expect(result).toBe(mockBuffer);
      expect(mockGroqTtsPolicy.generateAudio).toHaveBeenCalledWith(
        'text',
        'troy',
      );
    });

    it('throws when the Groq TTS policy is null', async () => {
      Object.defineProperty(service, 'groqTtsPolicyService', {
        value: null,
        writable: true,
      });

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq client not initialized',
      );
    });

    it('wraps policy error with Groq TTS failed prefix', async () => {
      mockGroqTtsPolicy.generateAudio.mockRejectedValue(
        new Error('unknown error'),
      );

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
