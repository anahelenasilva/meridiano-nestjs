import { NoteResponseDto } from '../../notes/note.entity';
import { ArticleCategory } from '../article.entity';

/**
 * The shape of one `GET /api/articles` item, so `openapi.json` carries a schema
 * the frontend can generate types from.
 *
 * `ListArticlesQuery`'s return type intersects this one, so dropping a declared
 * field from the assembly is a compile error. The reverse is not checked: items
 * are built by a function call, not a fresh object literal, so a field added to
 * the response and not declared here compiles and is simply absent from the
 * published schema. Add it in both places.
 *
 * `embedding` is deliberately absent: `articleColumns()` does not select it, so
 * the list item never carries it.
 */
export class ArticleListItemDto {
  id: string;
  url: string;
  title: string;
  published_date: Date;
  feed_source: string;
  feed_profile: string;
  raw_content: string;
  processed_content?: string | null;
  /** `raw_content` rendered to HTML, or null when the markdown failed to parse. */
  content_html: string | null;
  /** `processed_content` rendered to HTML, or null when absent or unparseable. */
  processed_content_html: string | null;
  impact_rating?: number | null;
  image_url?: string | null;
  categories?: ArticleCategory[] | null;
  custom_prompt?: string | null;
  created_at: Date;
  archived_at?: Date | null;
  has_audio: boolean;

  /** The requesting user's active private note, or null. Always null on the api-key path. */
  note: NoteResponseDto | null;

  /**
   * Whether the requesting user has bookmarked this article. Always false on the
   * api-key path, which has no user. Independent of archive state.
   */
  is_bookmarked: boolean;
}

export class ArticlesPaginationDto {
  page: number;
  per_page: number;
  total_pages: number;
  total_articles: number;
}

/** The filters the request was served with, echoed back as empty strings when unset. */
export class ArticlesFiltersDto {
  sort_by: string;
  direction: string;
  feed_profile: string;
  feed_source: string;
  search_term: string;
  start_date: string;
  end_date: string;
  preset: string;
  category: string;
}

export class ListArticlesResponseDto {
  articles: ArticleListItemDto[];
  pagination: ArticlesPaginationDto;
  filters: ArticlesFiltersDto;
  available_profiles: string[];
  available_categories: string[];
  available_sources: string[];
}
