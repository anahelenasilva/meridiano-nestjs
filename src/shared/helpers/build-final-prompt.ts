export function buildFinalPrompt(
  basePrompt: string,
  customPrompt?: string | null,
): string {
  if (!customPrompt || customPrompt.trim() === '') {
    return basePrompt;
  }

  return basePrompt + '\n\nAdditional instructions: ' + customPrompt;
}
