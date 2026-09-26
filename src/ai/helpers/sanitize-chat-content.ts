/**
 * Cleans a prompt before it goes into a chat request body. Lone UTF-16
 * surrogates (e.g. an emoji cut in half by `substring`) become U+FFFD, since
 * JSON.stringify emits them as `\udXXX` escapes that strict parsers like
 * DeepSeek's reject with "unexpected end of hex escape".
 */
export function sanitizeChatContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\x00')
    .join('')
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      '�',
    )
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}
