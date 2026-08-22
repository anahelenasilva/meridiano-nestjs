import { Injectable } from '@nestjs/common';
import { attachNotes, WithNote } from '../../notes/attach-notes';
import { NotesReadService } from '../../notes/notes-read.service';
import { Note } from '../../notes/note.entity';
import moment from 'moment';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlesService } from '../articles.service';
import { prepareArticleContent } from '../helpers/prepareArticleContent';

export type ListArticlesRequest = {
  page?: number;
  perPage?: number;
  sortBy?: string;
  direction?: string;
  feedProfile?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  preset?: string;
  category?: string;
};

type ListArticleItem = WithNote<Awaited<ReturnType<typeof prepareArticleContent>>>;

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
    search_term: string;
    start_date: string;
    end_date: string;
    preset: string;
    category: string;
  };
  available_profiles: string[];
  available_categories: string[];
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
      preset,
      searchTerm,
      sortBy = 'published_date',
      startDate,
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
    const availableCategories = await this.service.getDistinctCategories();

    const totalArticles = await this.service.countTotalArticles({
      feedProfile: feedProfile,
      searchTerm: searchTerm,
      startDate: startDateToSearch,
      endDate: endDateToSearch,
      category: category,
    });

    const totalPages = Math.ceil(totalArticles / perPage);

    const articles = await this.service.getArticlesPaginated({
      page,
      perPage,
      sortBy,
      direction: direction as 'asc' | 'desc',
      feedProfile: feedProfile,
      searchTerm: searchTerm,
      startDate: startDate,
      endDate: endDate,
      category: category,
    });

    // Prepare articles with HTML content
    const preparedArticles = await Promise.all(
      articles.map((article) => prepareArticleContent(article)),
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
        search_term: searchTerm ?? '',
        start_date: startDate ?? '',
        end_date: endDate ?? '',
        preset: preset ?? '',
        category: category ?? '',
      },
      available_profiles: availableProfiles,
      available_categories: availableCategories,
    };
  }

  private parseDatePreset(preset: string): {
    startDate?: string;
    endDate?: string;
  } {
    const now = moment();

    switch (preset) {
      case 'yesterday': {
        const yesterday = now.clone().subtract(1, 'day');
        return {
          startDate: yesterday.format('YYYY-MM-DD'),
          endDate: yesterday.format('YYYY-MM-DD'),
        };
      }
      case 'last_week':
        return {
          startDate: now.clone().subtract(7, 'days').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_30d':
        return {
          startDate: now.clone().subtract(30, 'days').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_3m':
        return {
          startDate: now.clone().subtract(3, 'months').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_12m':
        return {
          startDate: now.clone().subtract(12, 'months').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      default:
        return {};
    }
  }
}
