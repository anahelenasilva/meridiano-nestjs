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

  it('leaves backslashes single after the SDK encodes and the provider parses', () => {
    const source = 'O caminho é C:\\Users\\ana\\relatorio.txt e a regex \\d+';

    // What openai/core.js:219 writes into the request body and the provider's
    // JSON parser hands the model.
    const seenByModel = JSON.parse(
      JSON.stringify(sanitizeChatContent(source)),
    ) as string;

    expect(seenByModel).toBe(source);
  });
});
