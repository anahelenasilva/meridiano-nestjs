import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ArticlesService, ArticleListRow } from '../articles.service';

export type ListArticlesLeanRequest = {
  page?: number;
  perPage?: number;
  feedProfile?: string;
  feedSource?: string;
  startDate?: string;
  endDate?: string;
};

// The lean projection: identity/metadata fields plus raw (unrendered)
// processed_content and the derived has_audio flag. Deliberately omits the
// heavy fields the frontend needs (raw_content, embedding, rendered HTML,
// summary/impact/image/categories) so a CLI list stays cheap to fetch.
type LeanArticle = Pick<
  ArticleListRow,
  | 'id'
  | 'url'
  | 'title'
  | 'published_date'
  | 'feed_source'
  | 'feed_profile'
  | 'custom_prompt'
  | 'created_at'
  | 'has_audio'
  | 'processed_content'
>;
type LeanArticleItem = WithNote<LeanArticle>;

export type ListArticlesLeanResponse = {
  articles: LeanArticleItem[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_articles: number;
  };
  filters: {
    feed_profile: string;
    feed_source: string;
    start_date: string;
    end_date: string;
  };
};

function toLeanArticle(row: ArticleListRow): LeanArticle {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    published_date: row.published_date,
    feed_source: row.feed_source,
    feed_profile: row.feed_profile,
    custom_prompt: row.custom_prompt,
    created_at: row.created_at,
    has_audio: row.has_audio,
    processed_content: row.processed_content,
  };
}

/**
 * Backs GET /api/articles/lean. Shares the pagination/filter SQL with the full
 * list (same service methods) but returns only the fields a CLI listing needs.
 * Unlike ListArticlesQuery it does no markdown rendering and skips the
 * profiles/categories lookups.
 */
@Injectable()
export class ListArticlesLeanQuery {
  constructor(
    private readonly service: ArticlesService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    // Undefined on the api-key path (CLI/ops), which has no user. Notes are the
    // only user-scoped part of the response, so a missing user just means none.
    userId: string | undefined,
    request: ListArticlesLeanRequest,
  ): Promise<ListArticlesLeanResponse> {
    const {
      page = 1,
      perPage = 20,
      feedProfile,
      feedSource,
      startDate,
      endDate,
    } = request;

    const totalArticles = await this.service.countTotalArticles({
      feedProfile,
      feedSource,
      startDate,
      endDate,
    });
    const totalPages = Math.ceil(totalArticles / perPage);

    const rows = await this.service.getArticlesPaginated({
      page,
      perPage,
      feedProfile,
      feedSource,
      startDate,
      endDate,
    });

    const leanArticles = rows.map(toLeanArticle);

    const notesBySourceId = userId
      ? await this.notesReadService.getActiveNotesBySourceIds(
          userId,
          'article',
          leanArticles.map((article) => article.id),
        )
      : new Map<string, Note>();

    return {
      articles: attachNotes(
        leanArticles,
        (article) => article.id,
        notesBySourceId,
      ),
      pagination: {
        page,
        per_page: perPage,
        total_pages: totalPages,
        total_articles: totalArticles,
      },
      filters: {
        feed_profile: feedProfile ?? '',
        feed_source: feedSource ?? '',
        start_date: startDate ?? '',
        end_date: endDate ?? '',
      },
    };
  }
}
