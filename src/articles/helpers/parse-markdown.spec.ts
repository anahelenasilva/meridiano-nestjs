import { parseMarkdownArticle } from './parse-markdown';

describe('parseMarkdownArticle', () => {
  describe('Extract title from first H1', () => {
    it('should extract title from standard H1', () => {
      const markdown = '# Test Title\n\nSome content here.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Test Title');
      expect(result.content).toBe(markdown);
      expect(result.publishedDate).toBeInstanceOf(Date);
    });

    it('should extract title from H1 with extra spaces', () => {
      const markdown = '#  Title with Spaces  \n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title with Spaces');
    });

    it('should extract first H1 when multiple H1s exist', () => {
      const markdown =
        '# First Title\n\nSome content.\n\n# Second Title\n\nMore content.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('First Title');
    });

    it('should extract H1 with special characters', () => {
      const markdown = '# Título com Acentuação: Special & Chars!\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Título com Acentuação: Special & Chars!');
    });

    it('should extract very long title', () => {
      const longTitle = 'A'.repeat(200);
      const markdown = `# ${longTitle}\n\nContent.`;

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe(longTitle);
    });

    it('should extract title with numbers and symbols', () => {
      const markdown = '# Top 10 Items - 2024 ($100+)\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Top 10 Items - 2024 ($100+)');
    });

    it('should extract title with emoji', () => {
      const markdown = '# 🚀 Exciting News!\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('🚀 Exciting News!');
    });
  });

  describe('Handle missing H1', () => {
    it('should throw error when no H1 is found', () => {
      const markdown = 'Just some content without a heading.';

      expect(() => parseMarkdownArticle(markdown)).toThrow(
        'No H1 heading found in markdown content',
      );
    });

    it('should throw error for H2 instead of H1', () => {
      const markdown = '## This is H2\n\nContent.';

      expect(() => parseMarkdownArticle(markdown)).toThrow(
        'No H1 heading found in markdown content',
      );
    });

    it('should throw error for empty content', () => {
      const markdown = '';

      expect(() => parseMarkdownArticle(markdown)).toThrow(
        'Markdown content cannot be empty',
      );
    });

    it('should throw error for whitespace-only content', () => {
      const markdown = '   \n\n   \t   ';

      expect(() => parseMarkdownArticle(markdown)).toThrow(
        'Markdown content cannot be empty',
      );
    });

    it('should throw error for H1 with empty title', () => {
      const markdown = '#    \n\nContent.';

      expect(() => parseMarkdownArticle(markdown)).toThrow(
        'H1 heading is empty',
      );
    });
  });

  describe('Published date', () => {
    it('should use current date as publishedDate', () => {
      const markdown = '# Test Title\n\nContent.';
      const beforeDate = new Date();

      const result = parseMarkdownArticle(markdown);

      const afterDate = new Date();

      expect(result.publishedDate.getTime()).toBeGreaterThanOrEqual(
        beforeDate.getTime(),
      );
      expect(result.publishedDate.getTime()).toBeLessThanOrEqual(
        afterDate.getTime(),
      );
    });

    it('should create new date instance each time', () => {
      const markdown = '# Test Title\n\nContent.';

      const result1 = parseMarkdownArticle(markdown);
      const result2 = parseMarkdownArticle(markdown);

      expect(result1.publishedDate).not.toBe(result2.publishedDate);
      expect(result1.publishedDate.getTime()).toBeLessThanOrEqual(
        result2.publishedDate.getTime(),
      );
    });
  });

  describe('Content preservation', () => {
    it('should preserve full markdown content', () => {
      const markdown =
        '# Title\n\n## Section 1\n\nParagraph 1.\n\n### Subsection\n\nParagraph 2.';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });

    it('should preserve markdown formatting', () => {
      const markdown =
        '# Title\n\n**Bold** and *italic* text.\n\n- List item 1\n- List item 2\n\n```code block```';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });

    it('should preserve links and images', () => {
      const markdown =
        '# Title\n\n[Link text](https://example.com)\n\n![Alt text](https://example.com/image.png)';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });

    it('should preserve code blocks', () => {
      const markdown =
        '# Title\n\n```typescript\nconst x = 10;\nconsole.log(x);\n```\n\nMore content.';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });

    it('should preserve blockquotes', () => {
      const markdown = '# Title\n\n> This is a quote\n> Multiple lines\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });

    it('should preserve tables', () => {
      const markdown =
        '# Title\n\n| Col1 | Col2 |\n|------|------|\n| A    | B    |\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.content).toBe(markdown);
    });
  });

  describe('Edge cases', () => {
    it('should handle H1 at the end of file', () => {
      const markdown = 'Some intro text.\n\n# Title at End';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title at End');
      expect(result.content).toBe(markdown);
    });

    it('should handle only H1 with no other content', () => {
      const markdown = '# Only Title';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Only Title');
      expect(result.content).toBe(markdown);
    });

    it('should handle H1 with trailing whitespace', () => {
      const markdown = '# Title    \n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title');
    });

    it('should handle H1 in middle of content', () => {
      const markdown = 'Intro text.\n\n# Main Title\n\nBody content.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Main Title');
    });

    it('should handle Windows line endings (CRLF)', () => {
      const markdown = '# Title\r\n\r\nContent with CRLF.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title');
      expect(result.content).toBe(markdown);
    });

    it('should handle mixed line endings', () => {
      const markdown = '# Title\r\n\nMixed\rline\nendings.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title');
    });

    it('should handle H1 with inline code', () => {
      const markdown = '# Using `code` in Title\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Using `code` in Title');
    });

    it('should handle H1 with HTML entities', () => {
      const markdown = '# Title with &amp; &lt;tag&gt;\n\nContent.';

      const result = parseMarkdownArticle(markdown);

      expect(result.title).toBe('Title with &amp; &lt;tag&gt;');
    });
  });
});
