import { DBArticle } from '../../articles/article.entity';

export function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'article-1',
    url: 'https://example.com/a',
    title: 'An Article',
    published_date: new Date('2026-01-01'),
    feed_source: 'Example Feed',
    raw_content: 'raw content body',
    feed_profile: 'general',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}
