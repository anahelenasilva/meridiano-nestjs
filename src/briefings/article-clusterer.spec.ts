import { ArticleClusterer, EmbeddedArticle } from './article-clusterer';

describe('ArticleClusterer', () => {
  let clusterer: ArticleClusterer;

  beforeEach(() => {
    clusterer = new ArticleClusterer();
  });

  it('clusters two clearly separated groups into distinct clusters', () => {
    const articles: EmbeddedArticle[] = [
      { id: 'a1', embedding: [0.1, 0.1] },
      { id: 'a2', embedding: [0.15, 0.12] },
      { id: 'a3', embedding: [0.12, 0.09] },
      { id: 'b1', embedding: [10.0, 10.0] },
      { id: 'b2', embedding: [10.1, 9.9] },
      { id: 'b3', embedding: [9.9, 10.1] },
    ];

    const clusters = clusterer.cluster(articles, 2);

    expect(clusters).toHaveLength(2);

    const groupA = clusters.find(
      (c) =>
        c.articleIds.includes('a1') &&
        c.articleIds.includes('a2') &&
        c.articleIds.includes('a3'),
    );
    const groupB = clusters.find(
      (c) =>
        c.articleIds.includes('b1') &&
        c.articleIds.includes('b2') &&
        c.articleIds.includes('b3'),
    );
    expect(groupA).toBeDefined();
    expect(groupB).toBeDefined();
  });

  it('covers every article across all clusters', () => {
    const articles: EmbeddedArticle[] = Array.from({ length: 6 }, (_, i) => ({
      id: `article-${i}`,
      embedding: [i < 3 ? 0.1 : 10.0, i < 3 ? 0.1 : 10.0],
    }));

    const clusters = clusterer.cluster(articles, 2);

    const assignedIds = clusters.flatMap((c) => c.articleIds).sort();
    expect(assignedIds).toEqual(
      articles.map((a) => a.id).sort(),
    );
  });

  it('degrades gracefully when fewer articles than k', () => {
    const articles: EmbeddedArticle[] = [
      { id: 'a1', embedding: [1.0, 2.0] },
      { id: 'a2', embedding: [1.1, 2.1] },
    ];

    const clusters = clusterer.cluster(articles, 5);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].articleIds.sort()).toEqual(['a1', 'a2']);
  });

  it('returns empty array for no articles', () => {
    expect(clusterer.cluster([], 3)).toEqual([]);
  });

  it('returns single cluster for one article', () => {
    const clusters = clusterer.cluster([{ id: 'a1', embedding: [1.0, 2.0] }], 2);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].articleIds).toEqual(['a1']);
  });
});
