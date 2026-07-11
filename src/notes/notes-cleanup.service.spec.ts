import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { NotesCleanupService } from './notes-cleanup.service';

describe('NotesCleanupService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    run: jest.fn(),
  };

  let service: NotesCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new NotesCleanupService(mockDatabaseService);
  });

  it('deletes every note row for the source, including soft-deleted history', async () => {
    const sourceId = '11111111-1111-1111-1111-111111111111';
    mockDb.run.mockImplementation(function (query, params, callback) {
      callback.call({ changes: 3 }, null);
    });

    const removed = await service.purgeNotesForSource('article', sourceId);

    expect(removed).toBe(3);
    const [query, params] = mockDb.run.mock.calls[0];
    expect(query).toContain('DELETE FROM notes');
    expect(query).not.toContain('deleted_at');
    expect(params).toEqual(['article', sourceId]);
  });

  it('returns 0 when the source has no notes', async () => {
    mockDb.run.mockImplementation(function (query, params, callback) {
      callback.call({ changes: 0 }, null);
    });

    const removed = await service.purgeNotesForSource(
      'transcription',
      '22222222-2222-2222-2222-222222222222',
    );

    expect(removed).toBe(0);
  });

  it('rejects when the delete fails', async () => {
    const failure = new Error('db down');
    mockDb.run.mockImplementation(function (query, params, callback) {
      callback.call({}, failure);
    });

    await expect(
      service.purgeNotesForSource('article', 'some-id'),
    ).rejects.toThrow('db down');
  });
});
