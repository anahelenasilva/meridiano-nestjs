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