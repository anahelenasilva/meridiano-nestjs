import { averageEmbeddings } from './helpers/average-embeddings';
import { AiPolicyService } from './ai-policy.service';
import { AiAdapter } from './adapters/ai-adapter.interface';

function makeFakeAdapter(
  overrides: Partial<AiAdapter> = {},
): jest.Mocked<AiAdapter> {
  return {
    chat: jest.fn(),
    embed: jest.fn(),
    generateAudio: jest.fn(),
    ...overrides,
  } as jest.Mocked<AiAdapter>;
}

describe('AiPolicyService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('chat', () => {
    it('delegates to adapter and returns result', async () => {
      const adapter = makeFakeAdapter();
      (adapter.chat as jest.Mock).mockResolvedValue('response');
      const svc = new AiPolicyService(adapter);

      const result = await svc.chat('prompt', 'system', 'gpt-4');

      expect(result).toBe('response');
      expect(adapter.chat).toHaveBeenCalledWith('prompt', 'system', 'gpt-4');
    });

    it('retries on retryable error and returns eventual result', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (adapter.chat as jest.Mock)
        .mockRejectedValueOnce(new Error('rate limit 429'))
        .mockResolvedValueOnce('ok');
      const svc = new AiPolicyService(adapter);

      const result = await svc.chat('prompt');

      expect(result).toBe('ok');
      expect(adapter.chat).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('retries N=2 and returns result on third attempt', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (adapter.chat as jest.Mock)
        .mockRejectedValueOnce(new Error('rate limit 429'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('ok');
      const svc = new AiPolicyService(adapter);

      const result = await svc.chat('prompt');

      expect(result).toBe('ok');
      expect(adapter.chat).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('does not retry on non-retryable error', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (adapter.chat as jest.Mock).mockRejectedValue(
        new Error('invalid API key'),
      );
      const svc = new AiPolicyService(adapter);

      await expect(svc.chat('prompt')).rejects.toThrow('invalid API key');
      expect(adapter.chat).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('exhausts retries and throws after max retries', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (adapter.chat as jest.Mock).mockRejectedValue(new Error('timeout'));
      const svc = new AiPolicyService(adapter);

      await expect(svc.chat('prompt')).rejects.toThrow('timeout');
      expect(adapter.chat).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });
  });

  describe('embed', () => {
    it('returns null for empty text', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const svc = new AiPolicyService(adapter);

      const result = await svc.embed('');

      expect(result).toBeNull();
      expect(adapter.embed).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns null for whitespace-only text', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const svc = new AiPolicyService(adapter);

      expect(await svc.embed('   ')).toBeNull();
      consoleSpy.mockRestore();
    });

    it('returns single embedding for short text', async () => {
      const adapter = makeFakeAdapter();
      (adapter.embed as jest.Mock).mockResolvedValue([0.1, 0.2, 0.3]);
      const svc = new AiPolicyService(adapter, 1000);

      const result = await svc.embed('short text');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(adapter.embed).toHaveBeenCalledTimes(1);
    });

    it('chunks long text and averages embeddings', async () => {
      const adapter = makeFakeAdapter();
      (adapter.embed as jest.Mock)
        .mockResolvedValueOnce([1.0, 0.0])
        .mockResolvedValueOnce([0.0, 1.0]);

      const svc = new AiPolicyService(adapter, 10);
      const longText = 'First sentence here. Second sentence here.';

      const result = await svc.embed(longText);

      expect(adapter.embed).toHaveBeenCalledTimes(2);
      expect(result).toEqual([0.5, 0.5]);
    });

    it('retries on retryable embedding error and returns eventual result', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (adapter.embed as jest.Mock)
        .mockRejectedValueOnce(new Error('rate limit 429'))
        .mockResolvedValueOnce([0.5, 0.5]);
      const svc = new AiPolicyService(adapter, 1000);

      const result = await svc.embed('some text');

      expect(result).toEqual([0.5, 0.5]);
      expect(adapter.embed).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('returns null when all chunks fail', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (adapter.embed as jest.Mock).mockRejectedValue(new Error('timeout'));
      const svc = new AiPolicyService(adapter, 1000);

      const result = await svc.embed('some text');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('averageEmbeddings', () => {
    it('averages two known vectors element-wise', () => {
      const result = averageEmbeddings([
        [1.0, 3.0],
        [3.0, 1.0],
      ]);

      expect(result).toEqual([2.0, 2.0]);
    });

    it('returns the single vector unchanged', () => {
      const result = averageEmbeddings([[0.5, 0.5]]);

      expect(result).toEqual([0.5, 0.5]);
    });

    it('averages three vectors correctly', () => {
      const result = averageEmbeddings([
        [1.0, 2.0],
        [2.0, 4.0],
        [3.0, 6.0],
      ]);

      expect(result[0]).toBeCloseTo(2.0);
      expect(result[1]).toBeCloseTo(4.0);
    });

    it('throws on empty array', () => {
      expect(() => averageEmbeddings([])).toThrow('Cannot average empty');
    });
  });

  describe('generateAudio', () => {
    it('makes a single adapter call for text within the char limit', async () => {
      const mockBuffer = Buffer.from('audio');
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock).mockResolvedValue(mockBuffer);
      const svc = new AiPolicyService(adapter, undefined, 4096);

      const result = await svc.generateAudio('Hello', 'alloy');

      expect(adapter.generateAudio).toHaveBeenCalledTimes(1);
      expect(adapter.generateAudio).toHaveBeenCalledWith('Hello', 'alloy');
      expect(result.equals(mockBuffer)).toBe(true);
    });

    it('chunks text past the char limit and concatenates audio in order', async () => {
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock).mockImplementation((chunk: string) =>
        Promise.resolve(Buffer.from(chunk)),
      );
      const svc = new AiPolicyService(adapter, undefined, 20);
      const longText = 'First sentence here. Second sentence here.';

      const result = await svc.generateAudio(longText, 'alloy');

      const sentChunks = (adapter.generateAudio as jest.Mock).mock.calls.map(
        (call) => call[0] as string,
      );
      expect(sentChunks.length).toBeGreaterThan(1);
      expect(
        result.equals(Buffer.concat(sentChunks.map((c) => Buffer.from(c)))),
      ).toBe(true);
    });

    it('paces multi-chunk audio with the configured inter-chunk delay', async () => {
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock).mockImplementation((chunk: string) =>
        Promise.resolve(Buffer.from(chunk)),
      );
      const timeoutSpy = jest.spyOn(global, 'setTimeout');
      const svc = new AiPolicyService(adapter, undefined, 20, 100);
      const longText = 'First sentence here. Second sentence here.';

      await svc.generateAudio(longText, 'alloy');

      const chunkCount = (adapter.generateAudio as jest.Mock).mock.calls.length;
      const pacingCalls = timeoutSpy.mock.calls.filter(([, ms]) => ms === 100);
      // One pause between each pair of chunks, none after the last.
      expect(pacingCalls).toHaveLength(chunkCount - 1);
      timeoutSpy.mockRestore();
    });

    it('does not pace when the inter-chunk delay is zero', async () => {
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock).mockImplementation((chunk: string) =>
        Promise.resolve(Buffer.from(chunk)),
      );
      const timeoutSpy = jest.spyOn(global, 'setTimeout');
      const svc = new AiPolicyService(adapter, undefined, 20);
      const longText = 'First sentence here. Second sentence here.';

      await svc.generateAudio(longText, 'alloy');

      expect(timeoutSpy).not.toHaveBeenCalled();
      timeoutSpy.mockRestore();
    });

    it('retries a chunk on a retryable error', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock)
        .mockRejectedValueOnce(new Error('rate limit 429'))
        .mockResolvedValueOnce(Buffer.from('ok'));
      const svc = new AiPolicyService(adapter, undefined, 4096);

      const result = await svc.generateAudio('Hello', 'alloy');

      expect(adapter.generateAudio).toHaveBeenCalledTimes(2);
      expect(result.equals(Buffer.from('ok'))).toBe(true);
      consoleSpy.mockRestore();
    });
  });
});
