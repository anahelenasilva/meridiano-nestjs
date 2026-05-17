import { OpenAIAdapter } from './openai.adapter';

describe('OpenAIAdapter', () => {
  const mockChatCreate = jest.fn();
  const mockSpeechCreate = jest.fn();

  const mockChatClient = {
    chat: { completions: { create: mockChatCreate } },
  } as any;

  const mockTtsClient = {
    audio: { speech: { create: mockSpeechCreate } },
  } as any;

  const adapter = new OpenAIAdapter(
    mockChatClient,
    mockTtsClient,
    'gpt-4o-mini',
    2048,
    0.7,
    'alloy',
  );

  afterEach(() => jest.clearAllMocks());

  describe('chat', () => {
    it('calls SDK with correct args and returns trimmed content', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '  response  ' } }],
      });

      const result = await adapter.chat('prompt');

      expect(result).toBe('response');
      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'prompt' }],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      );
    });

    it('includes system prompt when provided', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await adapter.chat('user', 'system');

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'system' },
            { role: 'user', content: 'user' },
          ],
        }),
      );
    });

    it('uses model override when provided', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await adapter.chat('prompt', undefined, 'gpt-4');

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' }),
      );
    });

    it('throws when SDK returns empty content', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      });

      await expect(adapter.chat('prompt')).rejects.toThrow('empty response');
    });
  });

  describe('embed', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.embed('text')).rejects.toThrow(
        'Use TogetherAiAdapter for embeddings',
      );
    });
  });

  describe('generateAudio', () => {
    const mockArrayBuffer = new ArrayBuffer(8);

    it('calls TTS SDK with correct args for short text', async () => {
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await adapter.generateAudio('Hello world', 'nova');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockSpeechCreate).toHaveBeenCalledTimes(1);
      expect(mockSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'tts-1',
          voice: 'nova',
          input: 'Hello world',
          response_format: 'mp3',
        }),
      );
    });

    it('falls back to default voice for invalid voice', async () => {
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await adapter.generateAudio('text', 'bad-voice');

      expect(mockSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'alloy' }),
      );
    });

    it('chunks text longer than 4096 chars', async () => {
      const longText = 'A'.repeat(5000);
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      await adapter.generateAudio(longText, 'alloy');

      expect(mockSpeechCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('concatenates chunk audio in order', async () => {
      const longText = 'A'.repeat(5000);
      const chunk1 = new TextEncoder().encode('CHUNK1');
      const chunk2 = new TextEncoder().encode('CHUNK2');
      mockSpeechCreate
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(chunk1.buffer) })
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(chunk2.buffer) });

      const result = await adapter.generateAudio(longText, 'alloy');
      const expected = Buffer.concat([Buffer.from(chunk1), Buffer.from(chunk2)]);

      expect(result.equals(expected)).toBe(true);
    });
  });
});
