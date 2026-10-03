import { sanitizeChatContent } from './sanitize-chat-content';

describe('sanitizeChatContent', () => {
  it('replaces an emoji half left by truncating mid surrogate pair', () => {
    const truncated = 'IA lê 🤖 arquivos'.substring(0, 7);

    const sanitized = sanitizeChatContent(truncated);

    expect(sanitized).toBe('IA lê �');
    expect(JSON.stringify(sanitized)).not.toMatch(/\\ud[89a-f]/i);
  });

  it('keeps complete surrogate pairs intact', () => {
    expect(sanitizeChatContent('IA lê 🤖 arquivos')).toBe('IA lê 🤖 arquivos');
  });

  it('replaces a lone low surrogate', () => {
    expect(sanitizeChatContent('\uDD16 texto')).toBe('� texto');
  });
});
