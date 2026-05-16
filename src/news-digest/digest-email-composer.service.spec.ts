import { DBArticle } from '../articles/article.entity';
import { DigestEmailComposerService } from './digest-email-composer.service';

function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'test-id',
    url: 'https://example.com/article',
    title: 'Test Article',
    published_date: new Date('2026-05-15'),
    feed_source: 'Test Source',
    raw_content: '',
    feed_profile: 'technology',
    created_at: new Date(),
    ...overrides,
  };
}

describe('DigestEmailComposerService', () => {
  let service: DigestEmailComposerService;

  beforeEach(() => {
    service = new DigestEmailComposerService();
  });

  describe('compose', () => {
    it('renders title, source, and URL on consecutive lines separated by blank lines', () => {
      const articles = [
        makeArticle({
          title: 'AI Revolution',
          feed_source: 'TechCrunch',
          url: 'https://tc.com/1',
        }),
        makeArticle({
          title: 'Cloud Updates',
          feed_source: 'AWS Blog',
          url: 'https://aws.com/2',
        }),
      ];

      expect(service.compose(articles)).toBe(
        'AI Revolution\nTechCrunch\nhttps://tc.com/1\n\nCloud Updates\nAWS Blog\nhttps://aws.com/2',
      );
    });

    it('returns a non-empty string for empty array', () => {
      const result = service.compose([]);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('renders all 10 articles with 9 blank-line separators', () => {
      const articles = Array.from({ length: 10 }, (_, i) =>
        makeArticle({
          title: `Article ${i + 1}`,
          feed_source: `Source ${i + 1}`,
          url: `https://example.com/${i + 1}`,
        }),
      );

      const result = service.compose(articles);
      const blocks = result.split('\n\n');

      expect(blocks).toHaveLength(10);
      blocks.forEach((block, i) => {
        expect(block).toContain(`Article ${i + 1}`);
        expect(block).toContain(`Source ${i + 1}`);
        expect(block).toContain(`https://example.com/${i + 1}`);
      });
    });

    it('handles articles with undefined feed_source without crashing', () => {
      const article = makeArticle({ feed_source: undefined as unknown as string });

      expect(() => service.compose([article])).not.toThrow();
    });

    it('handles articles with undefined url without crashing', () => {
      const article = makeArticle({ url: undefined as unknown as string });

      expect(() => service.compose([article])).not.toThrow();
    });

    it('handles articles with undefined title without crashing', () => {
      const article = makeArticle({ title: undefined as unknown as string });

      expect(() => service.compose([article])).not.toThrow();
    });
  });
});
