import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { NotesReadService } from './notes-read.service';

describe('NotesReadService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    get: jest.fn(),
  };

  let service: NotesReadService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new NotesReadService(mockDatabaseService);
  });

  it('returns the active note mapped with Date instances', async () => {
    const userId = 'user-1';
    const articleId = '11111111-1111-1111-1111-111111111111';
    mockDb.get.mockImplementationOnce((query, params, callback) => {
      callback(null, {
        id: 'note-1',
        user_id: userId,
        source_type: 'article',
        source_id: articleId,
        content: 'My note',
        created_at: '2026-05-17T12:00:00.000Z',
        updated_at: '2026-05-17T12:05:00.000Z',
      });
    });

    const result = await service.getActiveNote(userId, 'article', articleId);

    expect(result).toEqual({
      id: 'note-1',
      user_id: userId,
      source_type: 'article',
      source_id: articleId,
      content: 'My note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:05:00.000Z'),
    });
    expect(mockDb.get.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(mockDb.get.mock.calls[0][1]).toEqual([userId, 'article', articleId]);
  });

  it('returns null when no active note exists', async () => {
    mockDb.get.mockImplementationOnce((query, params, callback) => {
      callback(null, undefined);
    });

    const result = await service.getActiveNote(
      'user-1',
      'transcription',
      '22222222-2222-2222-2222-222222222222',
    );

    expect(result).toBeNull();
  });

  it('rejects when the database query errors', async () => {
    mockDb.get.mockImplementationOnce((query, params, callback) => {
      callback(new Error('db down'));
    });

    await expect(
      service.getActiveNote(
        'user-1',
        'article',
        '11111111-1111-1111-1111-111111111111',
      ),
    ).rejects.toThrow('db down');
  });
});
