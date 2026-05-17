import { GroqAdapter } from './groq.adapter';

describe('GroqAdapter', () => {
  const mockCreate = jest.fn();
  const mockClient = { audio: { speech: { create: mockCreate } } } as any;

  const adapter = new GroqAdapter(mockClient, 'hannah');

  afterEach(() => jest.clearAllMocks());

  describe('generateAudio', () => {
    const mockArrayBuffer = new ArrayBuffer(4);

    it('calls SDK with correct args for short text', async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await adapter.generateAudio('Short text', 'troy');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'canopylabs/orpheus-v1-english',
          voice: 'troy',
          input: 'Short text',
          response_format: 'wav',
        }),
      );
    });

    it('falls back to default voice for invalid voice', async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await adapter.generateAudio('text', 'bad-voice');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'hannah' }),
      );
    });

    it('chunks text longer than 200 chars', async () => {
      const longText = 'This is a test sentence. '.repeat(20);
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await adapter.generateAudio(longText, 'hannah');

      expect(mockCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('concatenates chunk audio in order', async () => {
      const longText = 'This is a test sentence. '.repeat(20);
      const chunk1 = new TextEncoder().encode('GROQ1');
      const chunk2 = new TextEncoder().encode('GROQ2');
      const chunk3 = new TextEncoder().encode('GROQ3');
      mockCreate
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(chunk1.buffer) })
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(chunk2.buffer) })
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(chunk3.buffer) });

      const result = await adapter.generateAudio(longText, 'hannah');
      const expected = Buffer.concat([
        Buffer.from(chunk1),
        Buffer.from(chunk2),
        Buffer.from(chunk3),
      ]);

      expect(result.equals(expected)).toBe(true);
    });

    it('throws descriptive error on chunk failure', async () => {
      mockCreate.mockRejectedValue(new Error('service down'));

      await expect(adapter.generateAudio('text', 'hannah')).rejects.toThrow(
        'Groq TTS failed on chunk 1/1: service down',
      );
    });
  });

  describe('chat', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.chat('prompt')).rejects.toThrow(
        'Groq does not support chat',
      );
    });
  });

  describe('embed', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.embed('text')).rejects.toThrow(
        'Groq does not support embeddings',
      );
    });
  });
});
