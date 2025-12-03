import { marked } from 'marked';

import { DBArticle } from '../article.entity';

// Type-safe wrapper for marked.parse
const parseMarkdown = async (content: string): Promise<string> => {
  const result = await marked.parse(content);
  return typeof result === 'string' ? result : String(result);
};

export async function prepareArticleContent(article: DBArticle) {
  let processedContentHtml: string | null = null;
  let contentHtml: string | null = null;

  try {
    if (article.processed_content) {
      processedContentHtml = await parseMarkdown(article.processed_content);
    }
  } catch {
    processedContentHtml = null;
  }

  try {
    if (article.raw_content) {
      contentHtml = await parseMarkdown(article.raw_content);
    }
  } catch {
    contentHtml = null;
  }

  const response = {
    ...article,
    processed_content_html: processedContentHtml,
    content_html: contentHtml,
  };

  return response;
}
