import { marked } from 'marked';

import { DBArticle } from '../article.entity';
import { prepareArticleContent } from './prepareArticleContent';

function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'article-1',
    url: 'https://example.com',
    title: 'Test',
    published_date: new Date('2026-01-01T00:00:00Z'),
    feed_source: 'test',
    raw_content: '# Raw',
    processed_content: '**Processed**',
    feed_profile: 'default',
    created_at: new Date('2026-01-01T00:00:00Z'),
    custom_prompt: 'Focus on security.',
    ...overrides,
  };
}

describe('prepareArticleContent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders raw and processed markdown to HTML and keeps the article fields', async () => {
    const article = makeArticle();

    const result = await prepareArticleContent(article);

    expect(result).toEqual({
      ...article,
      content_html: '<h1>Raw</h1>\n',
      processed_content_html: '<p><strong>Processed</strong></p>\n',
    });
  });

  it('returns null HTML when the article has no content to render', async () => {
    const result = await prepareArticleContent(
      makeArticle({ raw_content: '', processed_content: null }),
    );

    expect(result.content_html).toBeNull();
    expect(result.processed_content_html).toBeNull();
  });

  it('returns null HTML instead of throwing when markdown parsing fails', async () => {
    jest.spyOn(marked, 'parse').mockRejectedValue(new Error('parse failed'));

    const result = await prepareArticleContent(makeArticle());

    expect(result.content_html).toBeNull();
    expect(result.processed_content_html).toBeNull();
  });
});
