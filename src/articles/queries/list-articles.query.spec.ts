import { mock } from 'jest-mock-extended';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { FeedProfile } from '../../shared/types/feed';
import { ArticleListRow, ArticlesService } from '../articles.service';
import { ListArticlesQuery } from './list-articles.query';

describe('ListArticlesQuery', () => {
  const mockService = mock<ArticlesService>();
  const mockProfilesService = mock<ProfilesService>();
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
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    categories: null,
    has_audio: true,
  };
  const articleB: ArticleListRow = {
    ...articleA,
    id: '22222222-2222-2222-2222-222222222222',
    url: 'https://example.com/b',
    title: 'Article B',
    raw_content: 'Raw B',
    processed_content: 'Processed B',
    has_audio: false,
  };

  let query: ListArticlesQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfilesService.getAvailableProfiles.mockReturnValue([
      FeedProfile.TECHNOLOGY,
    ]);
    mockService.getDistinctCategories.mockResolvedValue(['news']);
    mockService.countTotalArticles.mockResolvedValue(2);
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());

    query = new ListArticlesQuery(
      mockService,
      mockProfilesService,
      mockNotesReadService,
    );
  });

  it('embeds each owner active note on the article list via a single bulk lookup', async () => {
    mockService.getArticlesPaginated.mockResolvedValue([articleA, articleB]);
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

    expect(
      mockNotesReadService.getActiveNotesBySourceIds,
    ).toHaveBeenCalledTimes(1);
    expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
      userId,
      'article',
      [articleA.id, articleB.id],
    );
    expect(result?.articles).toHaveLength(2);
    expect(result?.articles[0].note).toEqual({
      id: 'note-a',
      content: 'Note on A',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    expect(result?.articles[1].note).toBeNull();
    expect(result?.articles[0].note).not.toHaveProperty('user_id');
    expect(result?.articles[0].note).not.toHaveProperty('source_id');
    expect(result?.articles[0].note).not.toHaveProperty('source_type');
  });

  it('sets note to null for every article when no active notes exist', async () => {
    mockService.getArticlesPaginated.mockResolvedValue([articleA, articleB]);

    const result = await query.execute(userId, {});

    expect(result?.articles.map((article) => article.note)).toEqual([
      null,
      null,
    ]);
  });

  it('skips the note lookup and returns null notes when there is no user (api-key path)', async () => {
    mockService.getArticlesPaginated.mockResolvedValue([articleA, articleB]);

    const result = await query.execute(undefined, {});

    expect(
      mockNotesReadService.getActiveNotesBySourceIds,
    ).not.toHaveBeenCalled();
    expect(result?.articles.map((article) => article.note)).toEqual([
      null,
      null,
    ]);
  });

  it('passes has_audio through unchanged from the service row to each response item', async () => {
    mockService.getArticlesPaginated.mockResolvedValue([articleA, articleB]);

    const result = await query.execute(userId, {});

    expect(result?.articles.map((article) => article.has_audio)).toEqual([
      true,
      false,
    ]);
  });
});
