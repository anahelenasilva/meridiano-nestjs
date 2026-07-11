import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { NotesReadService } from './notes-read.service';

describe('NotesReadService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
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

  describe('getActiveNotesBySourceIds', () => {
    const userId = 'user-1';
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const idC = '33333333-3333-3333-3333-333333333333';

    it('returns a map keyed by source_id, omitting sources with no active note', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        // Only idA and idC have active notes; idB is absent from the result set.
        callback(null, [
          {
            id: 'note-a',
            user_id: userId,
            source_type: 'article',
            source_id: idA,
            content: 'Note A',
            created_at: '2026-05-17T12:00:00.000Z',
            updated_at: '2026-05-17T12:05:00.000Z',
          },
          {
            id: 'note-c',
            user_id: userId,
            source_type: 'article',
            source_id: idC,
            content: 'Note C',
            created_at: '2026-05-18T09:00:00.000Z',
            updated_at: '2026-05-18T09:30:00.000Z',
          },
        ]);
      });

      const result = await service.getActiveNotesBySourceIds(userId, 'article', [
        idA,
        idB,
        idC,
      ]);

      expect(result.size).toBe(2);
      expect(result.get(idA)).toEqual({
        id: 'note-a',
        user_id: userId,
        source_type: 'article',
        source_id: idA,
        content: 'Note A',
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        updated_at: new Date('2026-05-17T12:05:00.000Z'),
      });
      expect(result.get(idC)?.content).toBe('Note C');
      expect(result.has(idB)).toBe(false);
    });

    it('issues a single query for a page of ids and filters soft-deleted notes', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getActiveNotesBySourceIds(userId, 'transcription', [
        idA,
        idB,
        idC,
      ]);

      expect(mockDb.all).toHaveBeenCalledTimes(1);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('deleted_at IS NULL');
      expect(query).toContain('source_id = ANY(?::uuid[])');
      expect(params).toEqual([userId, 'transcription', [idA, idB, idC]]);
    });

    it('de-duplicates repeated ids before binding the query', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(null, []);
      });

      await service.getActiveNotesBySourceIds(userId, 'article', [
        idA,
        idA,
        idB,
      ]);

      expect(mockDb.all.mock.calls[0][1]).toEqual([userId, 'article', [idA, idB]]);
    });

    it('short-circuits to an empty map without querying when given no ids', async () => {
      const result = await service.getActiveNotesBySourceIds(userId, 'article', []);

      expect(result.size).toBe(0);
      expect(mockDb.all).not.toHaveBeenCalled();
    });

    it('rejects when the database query errors', async () => {
      mockDb.all.mockImplementationOnce((query, params, callback) => {
        callback(new Error('db down'));
      });

      await expect(
        service.getActiveNotesBySourceIds(userId, 'article', [idA]),
      ).rejects.toThrow('db down');
    });
  });
});
