export function splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChunkSize) {
    let splitIndex = remaining.lastIndexOf('. ', maxChunkSize);

    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxChunkSize);
    }

    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      splitIndex = maxChunkSize;
    }

    let chunk = remaining.substring(0, splitIndex + 1).trim();
    if (!chunk.endsWith('.') && !chunk.endsWith('!') && !chunk.endsWith('?')) {
      chunk = remaining.substring(0, splitIndex).trim();
    }

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    remaining = remaining.substring(chunk.length).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
