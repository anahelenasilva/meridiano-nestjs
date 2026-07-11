import { S3Service } from '@libs/s3';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { AudioFilesService } from '../../audio-files/audio-files.service';
import { Note } from '../../notes/note.entity';
import { NotesReadService } from '../../notes/notes-read.service';
import { ArticlesService } from '../articles.service';
import { GetArticleByIdQuery } from './get-article-by-id.query';

describe('GetArticleByIdQuery', () => {
  const mockService = mock<ArticlesService>();
  const mockAudioFilesService = mock<AudioFilesService>();
  const mockS3Service = mock<S3Service>();
  const mockConfigService = mock<ConfigService>();
  const mockNotesReadService = mock<NotesReadService>();

  const userId = 'user-1';
  const articleId = '11111111-1111-1111-1111-111111111111';

  let query: GetArticleByIdQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    query = new GetArticleByIdQuery(
      mockService,
      mockAudioFilesService,
      mockS3Service,
      mockConfigService,
      mockNotesReadService,
    );
  });

  it('embeds the owner active note on the primary article using the stable shape', async () => {
    mockService.getArticleById.mockResolvedValue({
      id: articleId,
      title: 'Primary',
    } as never);
    mockService.getRelatedArticles.mockResolvedValue([]);
    mockNotesReadService.getActiveNote.mockResolvedValue({
      id: 'note-1',
      user_id: userId,
      source_type: 'article',
      source_id: articleId,
      content: 'My private note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    } as Note);

    const result = await query.execute(articleId, userId);

    expect(mockNotesReadService.getActiveNote).toHaveBeenCalledWith(
      userId,
      'article',
      articleId,
    );
    expect(result?.article.note).toEqual({
      id: 'note-1',
      content: 'My private note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    // The embedded shape must not leak ownership internals.
    expect(result?.article.note).not.toHaveProperty('user_id');
    expect(result?.article.note).not.toHaveProperty('source_id');
    expect(result?.article.note).not.toHaveProperty('source_type');
  });

  it('sets note to null when the primary article has no active note', async () => {
    mockService.getArticleById.mockResolvedValue({
      id: articleId,
      title: 'Primary',
    } as never);
    mockService.getRelatedArticles.mockResolvedValue([]);
    mockNotesReadService.getActiveNote.mockResolvedValue(null);

    const result = await query.execute(articleId, userId);

    expect(result?.article).toHaveProperty('note', null);
  });

  it('leaves related_articles note-free', async () => {
    mockService.getArticleById.mockResolvedValue({
      id: articleId,
      title: 'Primary',
    } as never);
    mockService.getRelatedArticles.mockResolvedValue([
      { id: 'related-1', title: 'Related 1' },
      { id: 'related-2', title: 'Related 2' },
    ] as never);
    mockNotesReadService.getActiveNote.mockResolvedValue({
      id: 'note-1',
      user_id: userId,
      source_type: 'article',
      source_id: articleId,
      content: 'My private note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    } as Note);

    const result = await query.execute(articleId, userId);

    expect(result?.related_articles).toHaveLength(2);
    for (const related of result?.related_articles ?? []) {
      expect(related).not.toHaveProperty('note');
    }
    // A single read means notes are only fetched for the primary article.
    expect(mockNotesReadService.getActiveNote).toHaveBeenCalledTimes(1);
  });

  it('returns null when the article does not exist', async () => {
    mockService.getArticleById.mockResolvedValue(null as never);

    const result = await query.execute(articleId, userId);

    expect(result).toBeNull();
    expect(mockNotesReadService.getActiveNote).not.toHaveBeenCalled();
  });
});
