import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { Note } from '../../notes/note.entity';
import {
  DateUnit,
  subtractFromDate,
  toLocalDateString,
} from '../../shared/helpers/date-math';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlesService } from '../articles.service';
import { prepareArticleContent } from '../helpers/prepareArticleContent';
import { ArchiveScope } from '../helpers/archive-scope';

export type ListArticlesRequest = {
  page?: number;
  perPage?: number;
  sortBy?: string;
  direction?: string;
  feedProfile?: string;
  feedSource?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  preset?: string;
  category?: string;
  archiveScope?: ArchiveScope;
};

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

// Presets that run from `amount` units ago through today. `yesterday` is the
// one preset that ends before today, so parseDatePreset handles it apart.
const PRESET_LOOKBACKS = new Map<string, readonly [number, DateUnit]>([
  ['last_week', [7, 'days']],
  ['last_30d', [30, 'days']],
  ['last_3m', [3, 'months']],
  ['last_12m', [12, 'months']],
]);

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

    let startDateToSearch = startDate;
    let endDateToSearch = endDate;

    if (preset) {
      const presetDates = this.parseDatePreset(preset);
      if (presetDates.startDate) {
        startDateToSearch = presetDates.startDate;
      }

      if (presetDates.endDate) {
        endDateToSearch = presetDates.endDate;
      }
    }

    const availableProfiles = this.profilesService.getAvailableProfiles();
    const [availableCategories, availableSources] = await Promise.all([
      this.service.getDistinctCategories(archiveScope),
      this.service.getDistinctFeedSources(archiveScope),
    ]);

    const totalArticles = await this.service.countTotalArticles({
      feedProfile: feedProfile,
      feedSource,
      searchTerm: searchTerm,
      startDate: startDateToSearch,
      endDate: endDateToSearch,
      category: category,
      archiveScope,
    });

    const totalPages = Math.ceil(totalArticles / perPage);

    const articles = await this.service.getArticlesPaginated({
      page,
      perPage,
      sortBy,
      direction: direction as 'asc' | 'desc',
      feedProfile: feedProfile,
      feedSource,
      searchTerm: searchTerm,
      startDate: startDate,
      endDate: endDate,
      category: category,
      archiveScope,
    });

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

  private parseDatePreset(preset: string): {
    startDate?: string;
    endDate?: string;
  } {
    const now = new Date();

    if (preset === 'yesterday') {
      const yesterday = toLocalDateString(subtractFromDate(now, 1, 'days'));
      return { startDate: yesterday, endDate: yesterday };
    }

    const lookback = PRESET_LOOKBACKS.get(preset);
    if (!lookback) {
      return {};
    }

    const [amount, unit] = lookback;
    return {
      startDate: toLocalDateString(subtractFromDate(now, amount, unit)),
      endDate: toLocalDateString(now),
    };
  }
}
