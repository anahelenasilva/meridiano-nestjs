import { mock } from 'jest-mock-extended';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { FeedProfile } from '../../shared/types/feed';
import { ArticleListRow, ArticlesService } from '../articles.service';
import {
  ListArticlesLeanQuery,
  ListArticlesLeanRequest,
} from './list-articles-lean.query';

describe('ListArticlesLeanQuery', () => {
  const mockService = mock<ArticlesService>();
  const mockNotesReadService = mock<NotesReadService>();

  const userId = 'user-1';
  const articleA: ArticleListRow = {
    id: '11111111-1111-1111-1111-111111111111',
    url: 'https://example.com/a',
    title: 'Article A',
    published_date: new Date('2024-01-01T00:00:00.000Z'),
    feed_source: 'Source A',
    raw_content: 'Raw A',
    processed_content: 'Processed A',
    embedding: null,
    impact_rating: 3,
    feed_profile: FeedProfile.TECHNOLOGY,
    image_url: null,
    created_at: new Date('2024-01-02T00:00:00.000Z'),
    categories: null,
    custom_prompt: 'Prompt A',
    has_audio: true,
  };
  const articleB: ArticleListRow = {
    ...articleA,
    id: '22222222-2222-2222-2222-222222222222',
    url: 'https://example.com/b',
    title: 'Article B',
    raw_content: 'Raw B',
    processed_content: 'Processed B',
    custom_prompt: null,
    has_audio: false,
  };

  let query: ListArticlesLeanQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());

    query = new ListArticlesLeanQuery(mockService, mockNotesReadService);
  });

  it('projects each article to exactly the lean field set plus note', async () => {
    mockService.listArticles.mockResolvedValue({
      articles: [articleA],
      total: 2,
    });

    const result = await query.execute(userId, {});

    expect(Object.keys(result.articles[0]).sort()).toEqual(
      [
        'id',
        'url',
        'title',
        'published_date',
        'feed_source',
        'feed_profile',
        'custom_prompt',
        'created_at',
        'has_audio',
        'processed_content',
        'note',
      ].sort(),
    );
  });

  it('passes processed_content through as raw markdown (no html key)', async () => {
    mockService.listArticles.mockResolvedValue({
      articles: [articleA],
      total: 2,
    });

    const result = await query.execute(userId, {});

    expect(result.articles[0].processed_content).toBe('Processed A');
    expect(result.articles[0]).not.toHaveProperty('processed_content_html');
    expect(result.articles[0]).not.toHaveProperty('content_html');
  });

  it('embeds each owner active note via a single bulk lookup', async () => {
    mockService.listArticles.mockResolvedValue({
      articles: [articleA, articleB],
      total: 2,
    });
    const noteA: Note = {
      id: 'note-a',
      user_id: userId,
      source_type: 'article',
      source_id: articleA.id,
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    };
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(
      new Map([[articleA.id, noteA]]),
    );

    const result = await query.execute(userId, {});

    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledTimes(
      1,
    );
    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
      userId,
      'article',
      [articleA.id, articleB.id],
    );
    expect(result.articles[0].note).toEqual({
      id: 'note-a',
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    expect(result.articles[1].note).toBeNull();
  });

  it('skips the note lookup and returns null notes on the api-key path (no user)', async () => {
    mockService.listArticles.mockResolvedValue({
      articles: [articleA, articleB],
      total: 2,
    });

    const result = await query.execute(undefined, {});

    expect(
      mockNotesReadService.getActiveNotesBySourceIds,
    ).not.toHaveBeenCalled();
    expect(result.articles.map((article) => article.note)).toEqual([null, null]);
  });

  it('returns pagination and only the CLI-supported filter keys', async () => {
    mockService.listArticles.mockResolvedValue({
      articles: [articleA, articleB],
      total: 5,
    });

    const result = await query.execute(userId, {
      page: 2,
      perPage: 2,
      feedProfile: FeedProfile.TECHNOLOGY,
      feedSource: 'Will Larson',
      startDate: '2024-01-01',
      endDate: '2024-02-01',
    });

    expect(result.pagination).toEqual({
      page: 2,
      per_page: 2,
      total_pages: 3,
      total_articles: 5,
    });
    expect(result.filters).toEqual({
      feed_profile: FeedProfile.TECHNOLOGY,
      feed_source: 'Will Larson',
      start_date: '2024-01-01',
      end_date: '2024-02-01',
    });
  });

  it('passes only the CLI-supported filter keys to the read', async () => {
    mockService.listArticles.mockResolvedValue({ articles: [], total: 0 });

    await query.execute(userId, {
      feedSource: 'Will Larson',
      searchTerm: 'ignored',
    } as ListArticlesLeanRequest);

    expect(mockService.listArticles).toHaveBeenCalledWith(
      {
        feedProfile: undefined,
        feedSource: 'Will Larson',
        startDate: undefined,
        endDate: undefined,
      },
      { page: 1, perPage: 20 },
    );
  });
});
