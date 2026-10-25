import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { averageEmbeddings } from './helpers/average-embeddings';
import { AiPolicyService } from './ai-policy.service';
import { AiAdapter } from './adapters/ai-adapter.interface';

const rateLimited = () =>
  new OpenAI.RateLimitError(429, undefined, 'Rate limit reached', undefined);
const connectionError = () =>
  new OpenAI.APIConnectionError({ message: 'Connection error.' });

// Call with fake timers on. The longest backoff is 600ms + 1200ms, so 2s of
// fake time settles any retry chain.
async function settle<T>(
  promise: Promise<T>,
): Promise<PromiseSettledResult<T>> {
  const settled = Promise.allSettled([promise]);
  await jest.advanceTimersByTimeAsync(2_000);
  const [result] = await settled;
  return result;
}

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
  afterEach(() => {
    jest.clearAllMocks();
    // Restore spies before timers: a setTimeout spy left on the fake clock
    // removes global.setTimeout when useRealTimers runs.
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

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
      jest.useFakeTimers();
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      (adapter.chat as jest.Mock)
        .mockRejectedValueOnce(rateLimited())
        .mockResolvedValueOnce('ok');
      const svc = new AiPolicyService(adapter);

      const result = await settle(svc.chat('prompt'));

      expect(result).toEqual({ status: 'fulfilled', value: 'ok' });
      expect(adapter.chat).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('retries N=2 and returns result on third attempt', async () => {
      jest.useFakeTimers();
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      (adapter.chat as jest.Mock)
        .mockRejectedValueOnce(rateLimited())
        .mockRejectedValueOnce(connectionError())
        .mockResolvedValueOnce('ok');
      const svc = new AiPolicyService(adapter);

      const result = await settle(svc.chat('prompt'));

      expect(result).toEqual({ status: 'fulfilled', value: 'ok' });
      expect(adapter.chat).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('does not retry on non-retryable error', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const error = new Error('invalid API key');
      (adapter.chat as jest.Mock).mockRejectedValue(error);
      const svc = new AiPolicyService(adapter);

      await expect(svc.chat('prompt')).rejects.toBe(error);
      expect(adapter.chat).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("exhausts retries and rejects with the adapter's error", async () => {
      jest.useFakeTimers();
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      const error = connectionError();
      (adapter.chat as jest.Mock).mockRejectedValue(error);
      const svc = new AiPolicyService(adapter);

      const result = await settle(svc.chat('prompt'));

      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBe(error);
      expect(adapter.chat).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('does not retry a provider timeout', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      (adapter.chat as jest.Mock).mockRejectedValue(
        new OpenAI.APIConnectionTimeoutError(),
      );
      const svc = new AiPolicyService(adapter);

      await expect(svc.chat('prompt')).rejects.toThrow('Request timed out.');
      expect(adapter.chat).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('backs off about 500ms, then about 1000ms', async () => {
      jest.useFakeTimers();
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      const timeoutSpy = jest.spyOn(global, 'setTimeout');
      (adapter.chat as jest.Mock).mockRejectedValue(rateLimited());
      const svc = new AiPolicyService(adapter);

      await settle(svc.chat('prompt'));

      const delays = timeoutSpy.mock.calls
        .map(([, ms]) => ms)
        .filter((ms): ms is number => typeof ms === 'number' && ms > 0);
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBeGreaterThanOrEqual(400);
      expect(delays[0]).toBeLessThanOrEqual(600);
      expect(delays[1]).toBeGreaterThanOrEqual(800);
      expect(delays[1]).toBeLessThanOrEqual(1200);
      timeoutSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('embed', () => {
    it('returns null for empty text', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      const svc = new AiPolicyService(adapter);

      const result = await svc.embed('');

      expect(result).toBeNull();
      expect(adapter.embed).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns null for whitespace-only text', async () => {
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
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
      jest.useFakeTimers();
      const adapter = makeFakeAdapter();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      (adapter.embed as jest.Mock)
        .mockRejectedValueOnce(rateLimited())
        .mockResolvedValueOnce([0.5, 0.5]);
      const svc = new AiPolicyService(adapter, 1000);

      const result = await settle(svc.embed('some text'));

      expect(result).toEqual({ status: 'fulfilled', value: [0.5, 0.5] });
      expect(adapter.embed).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('throws the provider error when every chunk fails', async () => {
      const adapter = makeFakeAdapter();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      (adapter.embed as jest.Mock).mockRejectedValue(
        new Error('400 Unable to access model'),
      );
      const svc = new AiPolicyService(adapter, 1000);

      await expect(svc.embed('some text')).rejects.toThrow(
        'Embedding failed for all 1 chunk(s): 400 Unable to access model',
      );
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('averages the chunks that succeeded when some fail', async () => {
      const adapter = makeFakeAdapter();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      (adapter.embed as jest.Mock)
        .mockRejectedValueOnce(new Error('400 bad chunk'))
        .mockResolvedValue([1, 3]);
      // 10-token limit forces the text into several chunks.
      const svc = new AiPolicyService(adapter, 10);

      const result = await svc.embed(
        'First sentence here is long. Second sentence here is long.',
      );

      expect(result).toEqual([1, 3]);
      warnSpy.mockRestore();
      errorSpy.mockRestore();
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
      jest.useFakeTimers();
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock)
        .mockRejectedValueOnce(rateLimited())
        .mockResolvedValueOnce(Buffer.from('ok'));
      const svc = new AiPolicyService(adapter, undefined, 4096);

      const result = await settle(svc.generateAudio('Hello', 'alloy'));

      expect(adapter.generateAudio).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ status: 'fulfilled', value: Buffer.from('ok') });
      consoleSpy.mockRestore();
    });

    it('stops at a failing chunk and requests no later chunks', async () => {
      const consoleSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const adapter = makeFakeAdapter();
      (adapter.generateAudio as jest.Mock)
        .mockResolvedValueOnce(Buffer.from('first'))
        .mockRejectedValue(new Error('400 bad voice'));
      const svc = new AiPolicyService(adapter, undefined, 20);

      await expect(
        svc.generateAudio(
          'First sentence here. Second sentence here. Third sentence here.',
          'alloy',
        ),
      ).rejects.toThrow('400 bad voice');
      expect(adapter.generateAudio).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });
});
