import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

const mockPoolInstance = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
};

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => mockPoolInstance),
  };
});

describe('DatabaseService', () => {
  let service: DatabaseService;
  let originalEnvState: {
    DATABASE_URL?: { value: string; existed: boolean };
    DATABASE_USER?: { value: string; existed: boolean };
    DATABASE_PASSWORD?: { value: string; existed: boolean };
    DATABASE_HOST?: { value: string; existed: boolean };
    DATABASE_PORT?: { value: string; existed: boolean };
    DATABASE_NAME?: { value: string; existed: boolean };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    originalEnvState = {
      DATABASE_URL: {
        value: process.env.DATABASE_URL ?? '',
        existed: 'DATABASE_URL' in process.env,
      },
      DATABASE_USER: {
        value: process.env.DATABASE_USER ?? '',
        existed: 'DATABASE_USER' in process.env,
      },
      DATABASE_PASSWORD: {
        value: process.env.DATABASE_PASSWORD ?? '',
        existed: 'DATABASE_PASSWORD' in process.env,
      },
      DATABASE_HOST: {
        value: process.env.DATABASE_HOST ?? '',
        existed: 'DATABASE_HOST' in process.env,
      },
      DATABASE_PORT: {
        value: process.env.DATABASE_PORT ?? '',
        existed: 'DATABASE_PORT' in process.env,
      },
      DATABASE_NAME: {
        value: process.env.DATABASE_NAME ?? '',
        existed: 'DATABASE_NAME' in process.env,
      },
    };

    process.env.DATABASE_USER = 'fake-test-user';
    process.env.DATABASE_PASSWORD = 'fake-test-password';
    process.env.DATABASE_HOST = 'localhost';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'fake-test-db';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);

    const mockClient = {
      release: jest.fn(),
    };
    mockPoolInstance.connect.mockResolvedValue(mockClient as never);
  });

  afterEach(() => {
    if (originalEnvState.DATABASE_URL?.existed) {
      process.env.DATABASE_URL = originalEnvState.DATABASE_URL.value;
    } else {
      delete process.env.DATABASE_URL;
    }

    if (originalEnvState.DATABASE_USER?.existed) {
      process.env.DATABASE_USER = originalEnvState.DATABASE_USER.value;
    } else {
      delete process.env.DATABASE_USER;
    }

    if (originalEnvState.DATABASE_PASSWORD?.existed) {
      process.env.DATABASE_PASSWORD = originalEnvState.DATABASE_PASSWORD.value;
    } else {
      delete process.env.DATABASE_PASSWORD;
    }

    if (originalEnvState.DATABASE_HOST?.existed) {
      process.env.DATABASE_HOST = originalEnvState.DATABASE_HOST.value;
    } else {
      delete process.env.DATABASE_HOST;
    }

    if (originalEnvState.DATABASE_PORT?.existed) {
      process.env.DATABASE_PORT = originalEnvState.DATABASE_PORT.value;
    } else {
      delete process.env.DATABASE_PORT;
    }

    if (originalEnvState.DATABASE_NAME?.existed) {
      process.env.DATABASE_NAME = originalEnvState.DATABASE_NAME.value;
    } else {
      delete process.env.DATABASE_NAME;
    }

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initDb', () => {
    it('should initialize database connection', async () => {
      await service.initDb();

      expect(mockPoolInstance.connect).toHaveBeenCalledTimes(1);
    });

    it('should use DATABASE_URL if provided', async () => {
      process.env.DATABASE_URL = 'postgresql://fake-user:fake-password@fake-host:5432/fake-db';

      await service.initDb();

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://fake-user:fake-password@fake-host:5432/fake-db',
      });
    });

    it('should build connection string from environment variables', async () => {
      delete process.env.DATABASE_URL;
      process.env.DATABASE_USER = 'fake-test-user';
      process.env.DATABASE_PASSWORD = 'fake-test-password';
      process.env.DATABASE_HOST = 'fake-test-host';
      process.env.DATABASE_PORT = '5433';
      process.env.DATABASE_NAME = 'fake-test-db';

      await service.initDb();

      expect(Pool).toHaveBeenCalledWith({
        connectionString: expect.stringContaining('fake-test-user'),
      });
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPoolInstance.connect.mockRejectedValueOnce(error);

      await expect(service.initDb()).rejects.toThrow('Connection failed');
    });
  });

  describe('getDbConnection', () => {
    it('should return database connection after initialization', async () => {
      await service.initDb();
      const connection = service.getDbConnection();

      expect(connection).toBeDefined();
      expect(connection).toHaveProperty('prepare');
      expect(connection).toHaveProperty('run');
      expect(connection).toHaveProperty('all');
      expect(connection).toHaveProperty('get');
    });

    it('should throw error if database not initialized', () => {
      expect(() => service.getDbConnection()).toThrow(
        'Database not initialized. Call initDb() first.',
      );
    });
  });

  describe('closeDb', () => {
    it('should close database connection', async () => {
      mockPoolInstance.end.mockResolvedValue(undefined);

      await service.initDb();
      await service.closeDb();

      expect(mockPoolInstance.end).toHaveBeenCalledTimes(1);
    });

    it('should handle close errors gracefully', async () => {
      const error = new Error('Close failed');
      mockPoolInstance.end.mockRejectedValueOnce(error);

      await service.initDb();
      await expect(service.closeDb()).rejects.toThrow('Close failed');
    });

    it('should not throw if database not initialized', async () => {
      await expect(service.closeDb()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close database connection', async () => {
      mockPoolInstance.end.mockResolvedValue(undefined);

      await service.initDb();
      await service.onModuleDestroy();

      expect(mockPoolInstance.end).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during destroy', async () => {
      const error = new Error('Destroy failed');
      mockPoolInstance.end.mockRejectedValueOnce(error);

      await service.initDb();
      await expect(service.onModuleDestroy()).rejects.toThrow('Destroy failed');
    });
  });
});
