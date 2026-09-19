import { DatabaseService, RunCallback } from '@libs/database';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { UsersService } from './users.service';

const USER_ROW = {
  id: 'user-1',
  email: 'ana@example.com',
  username: 'ana',
  created_at: '2026-09-01T12:00:00.000Z',
};

function uniqueViolation(detail?: string) {
  return Object.assign(
    new Error('duplicate key value violates unique constraint'),
    { code: '23505', detail },
  );
}

describe('UsersService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
  };
  let service: UsersService;

  const insertSucceeds = () =>
    mockDb.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
      callback.call({ changes: 1 }, null);
    });
  const insertFails = (err: Error) =>
    mockDb.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
      callback.call({}, err);
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new UsersService(mockDatabaseService);
    jest.spyOn(service, 'hashPassword').mockResolvedValue('hashed');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('createUser', () => {
    it('inserts the hashed password and returns the fetched user', async () => {
      insertSucceeds();
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, USER_ROW);
      });

      const user = await service.createUser('ana@example.com', 'ana', 'secret');

      expect(mockDb.run.mock.calls[0][1]).toEqual([
        'ana@example.com',
        'ana',
        'hashed',
      ]);
      expect(user).toEqual({
        id: 'user-1',
        email: 'ana@example.com',
        username: 'ana',
        isEmailVerified: undefined,
        created_at: new Date('2026-09-01T12:00:00.000Z'),
      });
    });

    it('maps an email unique violation to a ConflictException', async () => {
      insertFails(
        uniqueViolation('Key (email)=(ana@example.com) already exists.'),
      );

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(new ConflictException('Email already exists'));
    });

    it('maps a username unique violation to a ConflictException', async () => {
      insertFails(uniqueViolation('Key (username)=(ana) already exists.'));

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(new ConflictException('Username already exists'));
    });

    it('falls back to a generic conflict when the detail names neither field', async () => {
      insertFails(uniqueViolation());

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(
        new ConflictException(
          'User with this email or username already exists',
        ),
      );
    });

    it('maps any other insert failure to an InternalServerErrorException', async () => {
      insertFails(new Error('connection reset'));

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to create user. Please try again.',
        ),
      );
    });

    it('reports a fetch failure after a successful insert as its own error', async () => {
      insertSucceeds();
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('read timeout'));
      });

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'User created but failed to fetch details',
        ),
      );
    });

    it('rejects when the created user cannot be found', async () => {
      insertSucceeds();
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(
        service.createUser('ana@example.com', 'ana', 'secret'),
      ).rejects.toThrow(
        new InternalServerErrorException('User not found after creation'),
      );
    });
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

      const withPassword = await service.getUserByEmail('ana@example.com', true);
      const withoutPassword = await service.getUserByEmail('ana@example.com');

      expect(withPassword?.password).toBe('hashed');
      expect(withoutPassword).not.toHaveProperty('password');
    });
  });

  describe('updateUserPassword', () => {
    it('maps a write failure to an InternalServerErrorException', async () => {
      insertFails(new Error('db down'));

      await expect(
        service.updateUserPassword('user-1', 'new-secret'),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to update password'),
      );
    });
  });
});
