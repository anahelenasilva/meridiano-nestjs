import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '../config/config.service';

describe('AiService', () => {
  let service: AiService;
  let embeddingsCreate: jest.Mock;
  let deepseekChatCreate: jest.Mock;

  const configService = {
    getModelConfig: jest.fn(() => ({
      embeddingModel: 'intfloat/multilingual-e5-large-instruct',
      deepseekChatModel: 'deepseek-chat',
      openaiChatModel: 'gpt-4o-mini',
      maxTokens: 2048,
      temperature: 0.7,
    })),
    getEnabledChatModel: jest.fn(() => 'deepseek'),
  };

  beforeEach(async () => {
    embeddingsCreate = jest.fn();
    deepseekChatCreate = jest.fn();

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
});
