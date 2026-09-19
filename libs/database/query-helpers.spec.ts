import { RunCallback } from './database.interface';
import { execute, queryAll, queryOne } from './query-helpers';

describe('query helpers', () => {
  const db = {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryAll', () => {
    it('forwards sql and params and resolves the rows', async () => {
      db.all.mockImplementationOnce((sql, params, callback) => {
        callback(null, [{ id: 'a-1' }]);
      });

      const rows = await queryAll<{ id: string }>(
        db as never,
        'SELECT id FROM t WHERE x = ?',
        ['x'],
      );

      expect(rows).toEqual([{ id: 'a-1' }]);
      expect(db.all).toHaveBeenCalledWith(
        'SELECT id FROM t WHERE x = ?',
        ['x'],
        expect.any(Function),
      );
    });

    it('resolves an empty array when the driver passes no rows', async () => {
      db.all.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(queryAll(db as never, 'SELECT 1')).resolves.toEqual([]);
    });

    it('rejects with the driver error', async () => {
      db.all.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('db down'));
      });

      await expect(queryAll(db as never, 'SELECT 1')).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('queryOne', () => {
    it('resolves the row', async () => {
      db.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, { id: 'a-1' });
      });

      await expect(
        queryOne<{ id: string }>(db as never, 'SELECT id FROM t', []),
      ).resolves.toEqual({ id: 'a-1' });
    });

    it('resolves undefined when nothing matches', async () => {
      db.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(
        queryOne(db as never, 'SELECT id FROM t'),
      ).resolves.toBeUndefined();
    });

    it('rejects with the driver error', async () => {
      db.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('db down'));
      });

      await expect(queryOne(db as never, 'SELECT 1')).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('execute', () => {
    it('resolves the affected-row count from the callback context', async () => {
      db.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
        callback.call({ changes: 3 }, null);
      });

      await expect(
        execute(db as never, 'UPDATE t SET x = ?', ['x']),
      ).resolves.toBe(3);
      expect(db.run).toHaveBeenCalledWith(
        'UPDATE t SET x = ?',
        ['x'],
        expect.any(Function),
      );
    });

    it('resolves 0 when the driver reports no count', async () => {
      db.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
        callback.call({}, null);
      });

      await expect(execute(db as never, 'DELETE FROM t')).resolves.toBe(0);
    });

    it('rejects with the driver error', async () => {
      db.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
        callback.call({}, new Error('constraint'));
      });

      await expect(execute(db as never, 'DELETE FROM t')).rejects.toThrow(
        'constraint',
      );
    });
  });
});
