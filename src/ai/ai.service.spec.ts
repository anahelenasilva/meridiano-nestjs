import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '../config/config.service';

describe('AiService', () => {
  let service: AiService;
  let embeddingsCreate: jest.Mock;
  let deepseekChatCreate: jest.Mock;
  let openaiChatCreate: jest.Mock;
  let openaiSpeechCreate: jest.Mock;
  let groqSpeechCreate: jest.Mock;

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
  };

  beforeEach(async () => {
    embeddingsCreate = jest.fn();
    deepseekChatCreate = jest.fn();
    openaiChatCreate = jest.fn();
    openaiSpeechCreate = jest.fn();
    groqSpeechCreate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    Object.defineProperty(service, 'embeddingClient', {
      value: {
        embeddings: {
          create: embeddingsCreate,
        },
      },
      writable: true,
    });

    Object.defineProperty(service, 'deepseekClient', {
      value: {
        chat: {
          completions: {
            create: deepseekChatCreate,
          },
        },
      },
      writable: true,
    });

    Object.defineProperty(service, 'openaiChatClient', {
      value: {
        chat: {
          completions: {
            create: openaiChatCreate,
          },
        },
      },
      writable: true,
    });

    Object.defineProperty(service, 'openaiTtsClient', {
      value: {
        audio: {
          speech: {
            create: openaiSpeechCreate,
          },
        },
      },
      writable: true,
    });

    Object.defineProperty(service, 'groqClient', {
      value: {
        audio: {
          speech: {
            create: groqSpeechCreate,
          },
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBatchEmbeddings', () => {
    it('batches short inputs in a single request', async () => {
      embeddingsCreate.mockResolvedValue({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      });

      const results = await service.getBatchEmbeddings(['first', 'second']);

      expect(results).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);
      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'intfloat/multilingual-e5-large-instruct',
        input: ['passage: first', 'passage: second'],
      });
    });

    it('uses chunking fallback only for oversized inputs', async () => {
      const longText = 'Long sentence for embeddings. '.repeat(300);

      let invocation = 0;
      embeddingsCreate.mockImplementation(() => {
        invocation += 1;
        if (invocation === 1) {
          return {
            data: [{ embedding: [10, 20] }, { embedding: [30, 40] }],
          };
        }

        return {
          data: [{ embedding: [2, 2] }],
        };
      });

      const results = await service.getBatchEmbeddings([
        'short-one',
        longText,
        'short-two',
      ]);

      expect(results[0]).toEqual([10, 20]);
      expect(results[2]).toEqual([30, 40]);
      expect(results[1]).toEqual([2, 2]);
      expect(embeddingsCreate.mock.calls.length).toBeGreaterThan(1);
      expect(embeddingsCreate.mock.calls[0][0]).toEqual({
        model: 'intfloat/multilingual-e5-large-instruct',
        input: ['passage: short-one', 'passage: short-two'],
      });
    });

    it('falls back to per-item embedding when a short-input batch fails', async () => {
      embeddingsCreate
        .mockRejectedValueOnce(new Error('temporary batch failure'))
        .mockResolvedValueOnce({
          data: [{ embedding: [5, 6] }],
        })
        .mockResolvedValueOnce({
          data: [{ embedding: [7, 8] }],
        });

      const results = await service.getBatchEmbeddings(['alpha', 'beta']);

      expect(results).toEqual([
        [5, 6],
        [7, 8],
      ]);
      expect(embeddingsCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('getEmbedding', () => {
    it('returns null and logs warning for empty string', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.getEmbedding('');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Empty or whitespace-only text provided to getEmbedding',
      );
      expect(embeddingsCreate).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('returns null and logs warning for whitespace-only string', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.getEmbedding('   \t\n  ');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Empty or whitespace-only text provided to getEmbedding',
      );
      expect(embeddingsCreate).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('returns embedding for valid text', async () => {
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await service.getEmbedding('test text');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'intfloat/multilingual-e5-large-instruct',
        input: ['passage: test text'],
      });
    });

    it('adds passage prefix for E5 models', async () => {
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
      });

      await service.getEmbedding('some text');

      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'intfloat/multilingual-e5-large-instruct',
        input: ['passage: some text'],
      });
    });

    it('does not add passage prefix if already present', async () => {
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
      });

      await service.getEmbedding('passage: already prefixed');

      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'intfloat/multilingual-e5-large-instruct',
        input: ['passage: already prefixed'],
      });
    });

    it('does not add passage prefix for non-E5 models', async () => {
      configService.getModelConfig.mockReturnValueOnce({
        embeddingModel: 'some-other-model',
        deepseekChatModel: 'deepseek-chat',
        openaiChatModel: 'gpt-4o-mini',
        maxTokens: 2048,
        temperature: 0.7,
      });

      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
      });

      await service.getEmbedding('some text');

      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'some-other-model',
        input: ['some text'],
      });
    });

    it('retries on retriable errors (rate limit)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      embeddingsCreate
        .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
        .mockResolvedValueOnce({
          data: [{ embedding: [0.1, 0.2] }],
        });

      const result = await service.getEmbedding('test text');

      expect(result).toEqual([0.1, 0.2]);
      expect(embeddingsCreate).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('retrying'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('retries on retriable errors (timeout)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      embeddingsCreate
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({
          data: [{ embedding: [0.1, 0.2] }],
        });

      const result = await service.getEmbedding('test text');

      expect(result).toEqual([0.1, 0.2]);
      expect(embeddingsCreate).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });

    it('does not retry on non-retryable errors (authentication)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      embeddingsCreate.mockRejectedValue(
        new Error('Invalid API key or authentication failed'),
      );

      const result = await service.getEmbedding('test text');

      expect(result).toBeNull();
      // Called once for the main embedding attempt, not retried
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-retryable error'),
      );

      consoleErrorSpy.mockRestore();
    });

    it('does not retry on non-retryable errors (invalid request)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      embeddingsCreate.mockRejectedValue(
        new Error('Invalid request: model not found'),
      );

      const result = await service.getEmbedding('test text');

      expect(result).toBeNull();
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('exhausts retries and returns null after max retries', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      embeddingsCreate.mockRejectedValue(
        new Error('timeout'), // Retryable error
      );

      const result = await service.getEmbedding('test text');

      expect(result).toBeNull();
      // Initial call + 2 retries = 3 total
      expect(embeddingsCreate).toHaveBeenCalledTimes(3);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('chunking behavior', () => {
    it('handles long text by chunking and averaging embeddings', async () => {
      // Create text that will exceed token limit and need chunking
      const longText = 'This is a sentence. '.repeat(100);

      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [1.0, 2.0] }],
      });

      const result = await service.getEmbedding(longText);

      // Should return averaged embedding
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(embeddingsCreate).toHaveBeenCalled();
    });
  });

  describe('callDeepseekChat', () => {
    it('sanitizes invalid backslash escapes in prompt content', async () => {
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await service.callDeepseekChat('Path with invalid escape: \\x and \\q');

      expect(deepseekChatCreate).toHaveBeenCalledTimes(1);
      expect(deepseekChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: 'Path with invalid escape: \\\\x and \\\\q',
            },
          ],
        }),
      );
    });
  });

  describe('callOpenAIChat', () => {
    it('returns trimmed response content on success', async () => {
      openaiChatCreate.mockResolvedValue({
        choices: [{ message: { content: '  Hello world  ' } }],
      });

      const result = await service.callOpenAIChat('test prompt');

      expect(result).toBe('Hello world');
      expect(openaiChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test prompt' }],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      );
    });

    it('includes system prompt when provided', async () => {
      openaiChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await service.callOpenAIChat('user msg', undefined, 'system msg');

      expect(openaiChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'system msg' },
            { role: 'user', content: 'user msg' },
          ],
        }),
      );
    });

    it('uses custom model when provided', async () => {
      openaiChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await service.callOpenAIChat('prompt', 'gpt-4');

      expect(openaiChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' }),
      );
    });

    it('returns null on API error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      openaiChatCreate.mockRejectedValue(new Error('API failure'));

      const result = await service.callOpenAIChat('test prompt');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error calling OpenAI Chat API:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws when openaiChatClient is not initialized', async () => {
      Object.defineProperty(service, 'openaiChatClient', {
        value: null,
        writable: true,
      });

      await expect(service.callOpenAIChat('test')).rejects.toThrow(
        'OpenAI chat client not initialized',
      );
    });
  });

  describe('callChat', () => {
    it('routes to deepseek when ENABLED_CHAT_MODEL is deepseek', async () => {
      configService.getEnabledChatModel.mockReturnValue('deepseek');
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'deepseek response' } }],
      });

      const result = await service.callChat('test prompt');

      expect(result).toBe('deepseek response');
      expect(deepseekChatCreate).toHaveBeenCalledTimes(1);
      expect(openaiChatCreate).not.toHaveBeenCalled();
    });

    it('routes to openai when ENABLED_CHAT_MODEL is openai', async () => {
      configService.getEnabledChatModel.mockReturnValue('openai');
      openaiChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'openai response' } }],
      });

      const result = await service.callChat('test prompt');

      expect(result).toBe('openai response');
      expect(openaiChatCreate).toHaveBeenCalledTimes(1);
      expect(deepseekChatCreate).not.toHaveBeenCalled();
    });

    it('defaults to deepseek for unknown provider', async () => {
      configService.getEnabledChatModel.mockReturnValue('unknown' as any);
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'fallback' } }],
      });

      const result = await service.callChat('test');

      expect(result).toBe('fallback');
      expect(deepseekChatCreate).toHaveBeenCalledTimes(1);
    });

    it('passes model and systemPrompt through to the provider', async () => {
      configService.getEnabledChatModel.mockReturnValue('openai');
      openaiChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await service.callChat('prompt', 'gpt-4', 'be helpful');

      expect(openaiChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'be helpful' },
            { role: 'user', content: 'prompt' },
          ],
        }),
      );
    });
  });

  describe('generateAudio', () => {
    const mockArrayBuffer = new ArrayBuffer(8);

    it('routes to openai when TTS model is openai', async () => {
      configService.getEnabledTtsModel.mockReturnValue('openai');
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateAudio('Hello');

      expect(result).toBeInstanceOf(Buffer);
      expect(openaiSpeechCreate).toHaveBeenCalledTimes(1);
      expect(groqSpeechCreate).not.toHaveBeenCalled();
    });

    it('routes to groq when TTS model is groq', async () => {
      configService.getEnabledTtsModel.mockReturnValue('groq');
      groqSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateAudio('Hello');

      expect(result).toBeInstanceOf(Buffer);
      expect(groqSpeechCreate).toHaveBeenCalledTimes(1);
      expect(openaiSpeechCreate).not.toHaveBeenCalled();
    });

    it('defaults to openai for unknown TTS provider', async () => {
      configService.getEnabledTtsModel.mockReturnValue('unknown' as any);
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateAudio('Hello');

      expect(result).toBeInstanceOf(Buffer);
      expect(openaiSpeechCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateOpenAiAudio', () => {
    const mockArrayBuffer = new ArrayBuffer(4);

    it('generates audio for short text in a single chunk', async () => {
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateOpenAiAudio('Short text');

      expect(result).toBeInstanceOf(Buffer);
      expect(openaiSpeechCreate).toHaveBeenCalledTimes(1);
      expect(openaiSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'tts-1',
          voice: 'alloy',
          input: 'Short text',
          response_format: 'mp3',
        }),
      );
    });

    it('uses provided voice when valid', async () => {
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await service.generateOpenAiAudio('text', 'nova');

      expect(openaiSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'nova' }),
      );
    });

    it('falls back to default voice when invalid voice provided', async () => {
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await service.generateOpenAiAudio('text', 'invalid-voice');

      expect(openaiSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'alloy' }),
      );
    });

    it('chunks text longer than 4096 chars', async () => {
      const longText = 'A'.repeat(5000);
      openaiSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateOpenAiAudio(longText);

      expect(result).toBeInstanceOf(Buffer);
      expect(openaiSpeechCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('concatenates chunk audio in original order', async () => {
      const longText = 'A'.repeat(5000);
      const chunk1 = new TextEncoder().encode('OPENAI_CHUNK_1');
      const chunk2 = new TextEncoder().encode('OPENAI_CHUNK_2');
      openaiSpeechCreate
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(chunk1.buffer),
        })
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(chunk2.buffer),
        });

      const result = await service.generateOpenAiAudio(longText);
      const expected = Buffer.concat([Buffer.from(chunk1), Buffer.from(chunk2)]);

      expect(openaiSpeechCreate).toHaveBeenCalledTimes(2);
      expect(result.equals(expected)).toBe(true);
      expect(result.toString()).toBe('OPENAI_CHUNK_1OPENAI_CHUNK_2');
    });

    it('throws when openaiTtsClient is not initialized', async () => {
      Object.defineProperty(service, 'openaiTtsClient', {
        value: null,
        writable: true,
      });

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS client not initialized',
      );
    });

    it('throws descriptive error on API failure', async () => {
      openaiSpeechCreate.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.generateOpenAiAudio('text')).rejects.toThrow(
        'OpenAI TTS failed: quota exceeded',
      );
    });
  });

  describe('generateGroqAudio', () => {
    const mockArrayBuffer = new ArrayBuffer(4);

    it('generates audio for short text in a single chunk', async () => {
      groqSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateGroqAudio('Short text');

      expect(result).toBeInstanceOf(Buffer);
      expect(groqSpeechCreate).toHaveBeenCalledTimes(1);
      expect(groqSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'canopylabs/orpheus-v1-english',
          voice: 'hannah',
          input: 'Short text',
          response_format: 'wav',
        }),
      );
    });

    it('uses provided voice when valid', async () => {
      groqSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await service.generateGroqAudio('text', 'troy');

      expect(groqSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'troy' }),
      );
    });

    it('falls back to default voice when invalid voice provided', async () => {
      groqSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await service.generateGroqAudio('text', 'invalid-voice');

      expect(groqSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'hannah' }),
      );
    });

    it('chunks text longer than 200 chars', async () => {
      const longText = 'This is a test sentence. '.repeat(20);
      groqSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await service.generateGroqAudio(longText);

      expect(result).toBeInstanceOf(Buffer);
      expect(groqSpeechCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('concatenates chunk audio in original order', async () => {
      const longText = 'This is a test sentence. '.repeat(20);
      const chunk1 = new TextEncoder().encode('GROQ_CHUNK_1');
      const chunk2 = new TextEncoder().encode('GROQ_CHUNK_2');
      const chunk3 = new TextEncoder().encode('GROQ_CHUNK_3');
      groqSpeechCreate
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(chunk1.buffer),
        })
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(chunk2.buffer),
        })
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(chunk3.buffer),
        });

      const result = await service.generateGroqAudio(longText);
      const expected = Buffer.concat([
        Buffer.from(chunk1),
        Buffer.from(chunk2),
        Buffer.from(chunk3),
      ]);

      expect(groqSpeechCreate).toHaveBeenCalledTimes(3);
      expect(result.equals(expected)).toBe(true);
      expect(result.toString()).toBe('GROQ_CHUNK_1GROQ_CHUNK_2GROQ_CHUNK_3');
    });

    it('throws when groqClient is not initialized', async () => {
      Object.defineProperty(service, 'groqClient', {
        value: null,
        writable: true,
      });

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq client not initialized',
      );
    });

    it('throws descriptive error on chunk failure', async () => {
      groqSpeechCreate.mockRejectedValue(new Error('service unavailable'));

      await expect(service.generateGroqAudio('text')).rejects.toThrow(
        'Groq TTS failed on chunk 1/1: service unavailable',
      );
    });
  });

  describe('testApiConnectivity', () => {
    it('returns both true when all APIs respond', async () => {
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'OK' } }],
      });
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
      });

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(true);
      expect(result.embedding).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports deepseek failure when it returns null', async () => {
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
      });

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(false);
      expect(result.embedding).toBe(true);
      expect(result.errors).toContain('Deepseek API returned null response');
    });

    it('reports embedding failure when it returns null', async () => {
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'OK' } }],
      });
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [] }],
      });

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(true);
      expect(result.embedding).toBe(false);
      expect(result.errors).toContain(
        'Embedding API returned null or empty embedding',
      );
    });

    it('handles partial failure — deepseek throws, embedding works', async () => {
      Object.defineProperty(service, 'deepseekClient', {
        value: null,
        writable: true,
      });
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }],
      });

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(false);
      expect(result.embedding).toBe(true);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Deepseek API error');
    });

    it('handles partial failure — deepseek works, embedding throws', async () => {
      deepseekChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'OK' } }],
      });
      Object.defineProperty(service, 'embeddingClient', {
        value: null,
        writable: true,
      });

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(true);
      expect(result.embedding).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Embedding API error');
    });

    it('handles total failure — both APIs throw', async () => {
      deepseekChatCreate.mockRejectedValue(new Error('deepseek down'));
      embeddingsCreate.mockRejectedValue(new Error('embedding down'));

      const result = await service.testApiConnectivity();

      expect(result.deepseek).toBe(false);
      expect(result.embedding).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
});
