export function averageEmbeddings(embeddings: number[][]): number[] {
  if (!embeddings || embeddings.length === 0) {
    throw new Error('Cannot average empty embeddings array');
  }

  const vectorSize = embeddings[0].length;
  const sums = new Array<number>(vectorSize).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < vectorSize; i++) {
      sums[i] += embedding[i];
    }
  }

  return sums.map((sum) => sum / embeddings.length);
}
