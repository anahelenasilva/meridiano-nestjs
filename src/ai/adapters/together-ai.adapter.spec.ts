import { TogetherAiAdapter, isE5Model, getEmbeddingTokenLimit } from './together-ai.adapter';

describe('TogetherAiAdapter', () => {
  const mockCreate = jest.fn();
  const mockClient = { embeddings: { create: mockCreate } } as any;

  const model = 'intfloat/multilingual-e5-large-instruct';
  const adapter = new TogetherAiAdapter(mockClient, model);

  afterEach(() => jest.clearAllMocks());

  describe('embed', () => {
    it('calls SDK with E5 prefix and returns embedding', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await adapter.embed('some text');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockCreate).toHaveBeenCalledWith({
        model,
        input: ['passage: some text'],
      });
    });

    it('does not double-prefix text already prefixed', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.5] }],
      });

      await adapter.embed('passage: already prefixed');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: ['passage: already prefixed'] }),
      );
    });

    it('throws when SDK returns empty data', async () => {
      mockCreate.mockResolvedValue({ data: [] });

      await expect(adapter.embed('text')).rejects.toThrow('empty embedding response');
    });

    it('propagates SDK errors', async () => {
      mockCreate.mockRejectedValue(new Error('rate limit 429'));

      await expect(adapter.embed('text')).rejects.toThrow('rate limit 429');
    });
  });

  describe('batchEmbed', () => {
    it('calls SDK with all prepared inputs and returns all embeddings', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [1, 2] }, { embedding: [3, 4] }],
      });

      const results = await adapter.batchEmbed(['first', 'second']);

      expect(results).toEqual([[1, 2], [3, 4]]);
      expect(mockCreate).toHaveBeenCalledWith({
        model,
        input: ['passage: first', 'passage: second'],
      });
    });
  });

  describe('chat', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.chat('prompt')).rejects.toThrow(
        'Together.ai does not support chat',
      );
    });
  });

  describe('generateAudio', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.generateAudio('text', 'voice')).rejects.toThrow(
        'Together.ai does not support audio generation',
      );
    });
  });
});

describe('isE5Model', () => {
  it.each([
    ['intfloat/multilingual-e5-large-instruct', true],
    ['multilingual-e5-small', true],
    ['something/e5-base', true],
    ['e5-large', true],
    ['nomic-embed-text', false],
    ['bge-m3', false],
    ['text-embedding-ada-002', false],
  ])('%s → %s', (model, expected) => {
    expect(isE5Model(model)).toBe(expected);
  });
});

describe('getEmbeddingTokenLimit', () => {
  it.each([
    ['intfloat/multilingual-e5-large-instruct', 512],
    ['nomic-embed-text-v1.5', 8192],
    ['bge-m3', 8192],
    ['some-8k-model', 8192],
    ['unknown-model', 2048],
  ])('%s → %d', (model, expected) => {
    expect(getEmbeddingTokenLimit(model)).toBe(expected);
  });
});
