import { DeepseekAdapter } from './deepseek.adapter';

describe('DeepseekAdapter', () => {
  const mockCreate = jest.fn();
  const mockClient = {
    chat: { completions: { create: mockCreate } },
  } as any;

  const adapter = new DeepseekAdapter(mockClient, 'deepseek-chat', 2048, 0.7);

  afterEach(() => jest.clearAllMocks());

  describe('chat', () => {
    it('calls the SDK with prompt and returns trimmed content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '  hello  ' } }],
      });

      const result = await adapter.chat('test prompt');

      expect(result).toBe('hello');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'test prompt' }],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      );
    });

    it('includes system prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await adapter.chat('user msg', 'system msg');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'system msg' },
            { role: 'user', content: 'user msg' },
          ],
        }),
      );
    });

    it('uses provided model override', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await adapter.chat('prompt', undefined, 'deepseek-v3');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'deepseek-v3' }),
      );
    });

    it('throws when SDK returns empty content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(adapter.chat('prompt')).rejects.toThrow('empty response');
    });

    it('propagates SDK errors', async () => {
      mockCreate.mockRejectedValue(new Error('SDK failure'));

      await expect(adapter.chat('prompt')).rejects.toThrow('SDK failure');
    });

    it('sanitizes invalid backslash escapes', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });

      await adapter.chat('path \\x invalid');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'path \\\\x invalid' }],
        }),
      );
    });
  });

  describe('embed', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.embed('text')).rejects.toThrow(
        'Deepseek does not support embeddings',
      );
    });
  });

  describe('generateAudio', () => {
    it('throws not-supported error', async () => {
      await expect(adapter.generateAudio('text', 'alloy')).rejects.toThrow(
        'Deepseek does not support audio generation',
      );
    });
  });
});
