import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/services/youtube-transcriptions.service';
import { Note } from './note.entity';
import { NotesReadService } from './notes-read.service';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockArticlesService = mock<ArticlesService>();
  const mockYoutubeTranscriptionsService = mock<YoutubeTranscriptionsService>();
  const mockNotesReadService = mock<NotesReadService>();
  const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
  };

  let service: NotesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new NotesService(
      mockDatabaseService,
      mockArticlesService,
      mockYoutubeTranscriptionsService,
      mockNotesReadService,
    );
  });

  it('creates a new article note when no active note exists', async () => {
    const userId = 'user-1';
    const articleId = '11111111-1111-1111-1111-111111111111';
    mockArticlesService.getArticleById.mockResolvedValue({ id: articleId } as never);
    mockNotesReadService.getActiveNote.mockResolvedValue(null);
    mockDb.get.mockImplementationOnce((query, params, callback) => {
      callback(null, {
        id: 'note-1',
        user_id: userId,
        source_type: 'article',
        source_id: articleId,
        content: 'My note',
        created_at: '2026-05-17T12:00:00.000Z',
        updated_at: '2026-05-17T12:00:00.000Z',
      });
    });

    const result = await service.saveNote(userId, {
      source_type: 'article',
      source_id: articleId,
      content: 'My note',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'note-1',
        user_id: userId,
        source_type: 'article',
        source_id: articleId,
        content: 'My note',
      }),
    );
    expect(mockArticlesService.getArticleById).toHaveBeenCalledWith(articleId);
    expect(mockNotesReadService.getActiveNote).toHaveBeenCalledWith(
      userId,
      'article',
      articleId,
    );
    expect(mockDb.get.mock.calls[0][0]).toContain('INSERT INTO notes');
  });

  it('updates the active note in place for non-empty saves', async () => {
    const userId = 'user-1';
    const transcriptionId = '22222222-2222-2222-2222-222222222222';
    mockYoutubeTranscriptionsService.getTranscriptionById.mockResolvedValue({
      id: transcriptionId,
    } as never);
    mockNotesReadService.getActiveNote.mockResolvedValue({
      id: 'note-1',
      user_id: userId,
      source_type: 'transcription',
      source_id: transcriptionId,
      content: 'Old content',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:00:00.000Z'),
    } as Note);
    mockDb.get.mockImplementationOnce((query, params, callback) => {
      callback(null, {
        id: 'note-1',
        user_id: userId,
        source_type: 'transcription',
        source_id: transcriptionId,
        content: 'Updated content',
        created_at: '2026-05-17T12:00:00.000Z',
        updated_at: '2026-05-17T12:05:00.000Z',
      });
    });

    const result = await service.saveNote(userId, {
      source_type: 'transcription',
      source_id: transcriptionId,
      content: 'Updated content',
    });

    expect(result?.content).toBe('Updated content');
    expect(mockDb.get.mock.calls[0][0]).toContain('UPDATE notes');
  });

  it('soft-deletes the active note when content is whitespace-only', async () => {
    const userId = 'user-1';
    const articleId = '11111111-1111-1111-1111-111111111111';
    mockArticlesService.getArticleById.mockResolvedValue({ id: articleId } as never);
    mockNotesReadService.getActiveNote.mockResolvedValue({
      id: 'note-1',
      user_id: userId,
      source_type: 'article',
      source_id: articleId,
      content: 'Existing note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:00:00.000Z'),
    } as Note);
    mockDb.run.mockImplementationOnce((query, params, callback) => {
      callback(null);
      return {};
    });

    const result = await service.saveNote(userId, {
      source_type: 'article',
      source_id: articleId,
      content: '   ',
    });

    expect(result).toBeNull();
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notes'),
      ['note-1'],
      expect.any(Function),
    );
  });

  it('returns null without writing when blank content is saved with no active note', async () => {
    const userId = 'user-1';
    const articleId = '11111111-1111-1111-1111-111111111111';
    mockArticlesService.getArticleById.mockResolvedValue({ id: articleId } as never);
    mockNotesReadService.getActiveNote.mockResolvedValue(null);

    const result = await service.saveNote(userId, {
      source_type: 'article',
      source_id: articleId,
      content: '\n\t',
    });

    expect(result).toBeNull();
    expect(mockDb.run).not.toHaveBeenCalled();
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('retries on unique constraint conflicts so concurrent creates become last-write-wins', async () => {
    const userId = 'user-1';
    const articleId = '11111111-1111-1111-1111-111111111111';
    mockArticlesService.getArticleById.mockResolvedValue({ id: articleId } as never);
    mockNotesReadService.getActiveNote
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'note-1',
        user_id: userId,
        source_type: 'article',
        source_id: articleId,
        content: 'Other writer content',
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        updated_at: new Date('2026-05-17T12:00:00.000Z'),
      } as Note);
    mockDb.get
      .mockImplementationOnce((query, params, callback) => {
        const error = new Error('duplicate key value violates unique constraint');
        (error as Error & { code?: string }).code = '23505';
        callback(error);
      })
      .mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: 'note-1',
          user_id: userId,
          source_type: 'article',
          source_id: articleId,
          content: 'Latest content',
          created_at: '2026-05-17T12:00:00.000Z',
          updated_at: '2026-05-17T12:01:00.000Z',
        });
      });

    const result = await service.saveNote(userId, {
      source_type: 'article',
      source_id: articleId,
      content: 'Latest content',
    });

    expect(result?.content).toBe('Latest content');
    expect(mockNotesReadService.getActiveNote).toHaveBeenCalledTimes(2);
    expect(mockDb.get.mock.calls[0][0]).toContain('INSERT INTO notes');
    expect(mockDb.get.mock.calls[1][0]).toContain('UPDATE notes');
  });

  it('throws not found when the parent article does not exist', async () => {
    mockArticlesService.getArticleById.mockResolvedValue(null);

    await expect(
      service.saveNote('user-1', {
        source_type: 'article',
        source_id: '11111111-1111-1111-1111-111111111111',
        content: 'My note',
      }),
    ).rejects.toThrow(new NotFoundException('Article not found'));
  });
});
