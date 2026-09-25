import { ArticleCategory, DBArticle } from './article.entity';

export interface ArticleRow {
  id: string;
  url: string;
  title: string;
  published_date: string;
  feed_source: string;
  raw_content: string;
  processed_content?: string | null;
  embedding?: string | null;
  impact_rating?: number | null;
  feed_profile: string;
  image_url?: string | null;
  categories?: string | null;
  custom_prompt?: string | null;
  created_at: string;
  archived_at?: string | null;
}

const ARTICLE_COLUMN_NAMES = [
  'id',
  'url',
  'title',
  'published_date',
  'feed_source',
  'feed_profile',
  'raw_content',
  'processed_content',
  'impact_rating',
  'image_url',
  'categories',
  'custom_prompt',
  'created_at',
  'archived_at',
] as const satisfies readonly (keyof ArticleRow)[];

/**
 * Column list for every read that returns an Article, so a new column is added
 * once instead of at each call site. Missing one is a silent null field, not a
 * compiler error or a failing test. Pass `alias` for joined queries, such as
 * bookmarks' `a`.
 */
export function articleColumns(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return ARTICLE_COLUMN_NAMES.map((column) => `${prefix}${column}`).join(', ');
}

/** Pairs with articleColumns(): every Article read maps its row through here. */
export function mapArticleRow(row: ArticleRow): DBArticle {
  return {
    ...row,
    published_date: new Date(row.published_date),
    created_at: new Date(row.created_at),
    categories: row.categories
      ? (JSON.parse(row.categories) as ArticleCategory[])
      : undefined,
    archived_at: row.archived_at ? new Date(row.archived_at) : null,
  };
}
