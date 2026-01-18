export interface ParsedMarkdownArticle {
  title: string;
  content: string;
  publishedDate: Date;
}

export function parseMarkdownArticle(
  markdownContent: string,
): ParsedMarkdownArticle {
  if (!markdownContent || markdownContent.trim() === '') {
    throw new Error('Markdown content cannot be empty');
  }

  const h1Match = markdownContent.match(/^#[ \t]+(.+?)[ \t]*$/m);

  if (!h1Match) {
    throw new Error('No H1 heading found in markdown content');
  }

  const title = h1Match[1].trim();

  if (!title) {
    throw new Error('H1 heading is empty');
  }

  return {
    title,
    content: markdownContent,
    publishedDate: new Date(),
  };
}
