import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { Note } from '../../notes/note.entity';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlePage, ArticlesService } from '../articles.service';
import { prepareArticleContent } from '../helpers/prepareArticleContent';
import { ArticleFilter } from '../helpers/article-filter';

export type ListArticlesRequest = ArticleFilter & ArticlePage;

// has_audio is added after prepareArticleContent (whose declared parameter
// type is DBArticle, not the has_audio-carrying read model) rather than
// folded into its return type.
type PreparedArticle = Awaited<ReturnType<typeof prepareArticleContent>> & {
  has_audio: boolean;
};

type ListArticleItem = WithNote<PreparedArticle>;

export type ListArticlesResponse = {
  articles: ListArticleItem[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_articles: number;
  };
  filters: {
    sort_by: string;
    direction: string;
    feed_profile: string;
    feed_source: string;
    search_term: string;
    start_date: string;
    end_date: string;
    preset: string;
    category: string;
  };
  available_profiles: string[];
  available_categories: string[];
  available_sources: string[];
};

@Injectable()
export class ListArticlesQuery {
  constructor(
    private readonly service: ArticlesService,
    private readonly profilesService: ProfilesService,
    private readonly notesReadService: NotesReadService,
  ) {}

  async execute(
    // Undefined on the api-key path (CLI/ops), which has no user. Notes are the
    // only user-scoped part of the response, so a missing user just means none.
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
    const notesBySourceId = userId
      ? await this.notesReadService.getActiveNotesBySourceIds(
          userId,
          'article',
          preparedArticles.map((article) => article.id),
        )
      : new Map<string, Note>();

    return {
      articles: attachNotes(
        preparedArticles,
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
