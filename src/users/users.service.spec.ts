import { DatabaseService } from '@libs/database';
import { InternalServerErrorException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { UsersService } from './users.service';

const USER_ROW = {
  id: 'user-1',
  email: 'ana@example.com',
  username: 'ana',
  created_at: '2026-09-01T12:00:00.000Z',
};

describe('UsersService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    get: jest.fn(),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new UsersService(mockDatabaseService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('getUserById', () => {
    it('resolves null when no user matches', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.getUserById('missing')).resolves.toBeNull();
    });

    it('maps a query failure to an InternalServerErrorException', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('db down'));
      });

      await expect(service.getUserById('user-1')).rejects.toThrow(
        new InternalServerErrorException('Failed to fetch user'),
      );
    });

    it('rejects instead of throwing when the database is not initialized', async () => {
      mockDatabaseService.getDbConnection.mockImplementationOnce(() => {
        throw new Error('Database not initialized. Call initDb() first.');
      });

      await expect(service.getUserById('user-1')).rejects.toThrow(
        'Database not initialized. Call initDb() first.',
      );
    });
  });

  describe('getUserByEmail', () => {
    it('includes the password only when asked', async () => {
      const returnsRowWithPassword = (
        sql: string,
        params: unknown[],
        callback: (err: Error | null, row?: unknown) => void,
      ) => {
        callback(null, { ...USER_ROW, password: 'hashed' });
      };
      mockDb.get
        .mockImplementationOnce(returnsRowWithPassword)
        .mockImplementationOnce(returnsRowWithPassword);

      const withPassword = await service.getUserByEmail(
        'ana@example.com',
        true,
      );
      const withoutPassword = await service.getUserByEmail('ana@example.com');

      expect(withPassword?.password).toBe('hashed');
      expect(withoutPassword).not.toHaveProperty('password');
    });
  });
});
