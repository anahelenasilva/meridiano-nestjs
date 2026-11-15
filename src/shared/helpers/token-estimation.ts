export function estimateTokenCount(
  text: string,
  charsPerToken: number = 2.5,
): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const charEstimate = Math.ceil(text.length / charsPerToken);

  const words = text.trim().split(/\s+/).length;
  const punctuationMatches = text.match(/[.,!?;:"'()[\]{}]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  const wordEstimate = words + Math.ceil(punctuationCount * 0.5);

  return Math.max(charEstimate, wordEstimate);
}

export const estimateChatTokens = (text: string): number =>
  estimateTokenCount(text, 4);

export const estimateEmbeddingTokens = (text: string): number =>
  estimateTokenCount(text, 2.5);

/**
 * Cuts `text` to roughly `maxTokens` estimated chat tokens, ending on the last
 * sentence boundary when one sits in the final 20% of the cut. Returns `text`
 * unchanged when it already fits, so callers detect a cut by comparing lengths.
 */
export function truncateToChatTokens(text: string, maxTokens: number): string {
  const tokens = estimateChatTokens(text);
  if (tokens <= maxTokens) {
    return text;
  }

  const charsPerToken = text.length / tokens;
  const targetChars = Math.floor(maxTokens * charsPerToken);

  const truncated = text.substring(0, targetChars);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  );

  if (lastSentenceEnd > targetChars * 0.8) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  return truncated;
}
