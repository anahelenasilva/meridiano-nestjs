import { Injectable } from '@nestjs/common';
import { attachBookmarks, WithBookmark } from '../../bookmarks/attach-bookmarks';
import { BookmarksReadService } from '../../bookmarks/bookmarks-read.service';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { Note } from '../../notes/note.entity';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlePage, ArticlesService } from '../articles.service';
import { ListArticlesResponseDto } from '../dto/list-articles-response.dto';
import { prepareArticleContent } from '../helpers/prepareArticleContent';
import { ArticleFilter } from '../helpers/article-filter';

export type ListArticlesRequest = ArticleFilter & ArticlePage;

// has_audio is added after prepareArticleContent (whose declared parameter
// type is DBArticle, not the has_audio-carrying read model) rather than
// folded into its return type.
type PreparedArticle = Awaited<ReturnType<typeof prepareArticleContent>> & {
  has_audio: boolean;
};

type ListArticleItem = WithBookmark<WithNote<PreparedArticle>>;

// Intersected with the DTO that publishes this response's OpenAPI schema, so a
// field dropped from the assembly fails to compile instead of silently leaving
// the schema the frontend generates its types from.
export type ListArticlesResponse = ListArticlesResponseDto & {
  articles: ListArticleItem[];
};

@Injectable()
export class ListArticlesQuery {
  constructor(
    private readonly service: ArticlesService,
    private readonly profilesService: ProfilesService,
    private readonly notesReadService: NotesReadService,
    private readonly bookmarksReadService: BookmarksReadService,
  ) {}

  async execute(
    // Undefined on the api-key path (CLI/ops), which has no user. Notes and
    // bookmark state are the only user-scoped parts of the response, so a
    // missing user just means no note and not bookmarked.
    userId: string | undefined,
    request: ListArticlesRequest,
  ): Promise<ListArticlesResponse | null> {
    const {
      page = 1,
      perPage = 20,
      category,
      direction = 'desc',
      endDate,
      feedProfile,
      feedSource,
      preset,
      searchTerm,
      sortBy = 'published_date',
      startDate,
      archiveScope = 'active',
    } = request;

    const availableProfiles = this.profilesService.getAvailableProfiles();
    const [availableCategories, availableSources] = await Promise.all([
      this.service.getDistinctCategories(archiveScope),
      this.service.getDistinctFeedSources(archiveScope),
    ]);

    const { articles, total: totalArticles } = await this.service.listArticles(
      {
        feedProfile,
        feedSource,
        searchTerm,
        startDate,
        endDate,
        preset,
        category,
        archiveScope,
      },
      { page, perPage, sortBy, direction },
    );
    const totalPages = Math.ceil(totalArticles / perPage);

    // Prepare articles with HTML content. prepareArticleContent's declared
    // parameter type is DBArticle, so has_audio (present at runtime via the
    // row spread) is re-attached explicitly to keep it in the static type too.
    const preparedArticles: PreparedArticle[] = await Promise.all(
      articles.map(async (article) => ({
        ...(await prepareArticleContent(article)),
        has_audio: article.has_audio,
      })),
    );
    const articleIds = preparedArticles.map((article) => article.id);
    const [notesBySourceId, bookmarkedArticleIds] = userId
      ? await Promise.all([
          this.notesReadService.getActiveNotesBySourceIds(
            userId,
            'article',
            articleIds,
          ),
          this.bookmarksReadService.getBookmarkedArticleIds(userId, articleIds),
        ])
      : [new Map<string, Note>(), new Set<string>()];
    const articlesWithNotes = attachNotes(
      preparedArticles,
      (article) => article.id,
      notesBySourceId,
    );

    return {
      articles: attachBookmarks(
        articlesWithNotes,
        (article) => article.id,
        bookmarkedArticleIds,
      ),
      pagination: {
        page,
        per_page: perPage,
        total_pages: totalPages,
        total_articles: totalArticles,
      },
      filters: {
        sort_by: sortBy,
        direction: direction,
        feed_profile: feedProfile ?? '',
        feed_source: feedSource ?? '',
        search_term: searchTerm ?? '',
        start_date: startDate ?? '',
        end_date: endDate ?? '',
        preset: preset ?? '',
        category: category ?? '',
      },
      available_profiles: availableProfiles,
      available_categories: availableCategories,
      available_sources: availableSources,
    };
  }
}
