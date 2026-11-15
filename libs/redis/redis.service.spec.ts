import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { mock } from 'jest-mock-extended';
import { RedisService } from './redis.service';

jest.mock('ioredis');

const REDIS_ENV_KEYS = [
  'REDIS_URL',
  'REDISCLOUD_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
] as const;

describe('RedisService', () => {
  let moduleRef: TestingModule;
  const mockRedisClient = mock<Redis>();
  const RedisMock = Redis as unknown as jest.Mock;

  async function createService(): Promise<RedisService> {
    moduleRef = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();
    await moduleRef.init();
    return moduleRef.get(RedisService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    RedisMock.mockImplementation(() => mockRedisClient);
    for (const key of REDIS_ENV_KEYS) delete process.env[key];
  });

  afterEach(async () => {
    await moduleRef.close();
    for (const key of REDIS_ENV_KEYS) delete process.env[key];
  });

  it('returns the client it created', async () => {
    const service = await createService();

    expect(service.getClient()).toBe(mockRedisClient);
  });

  it('connects to REDIS_URL over REDISCLOUD_URL', async () => {
    process.env.REDIS_URL = 'redis://primary';
    process.env.REDISCLOUD_URL = 'redis://fallback';

    await createService();

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://primary',
      expect.any(Object),
    );
  });

  it('connects to REDISCLOUD_URL when REDIS_URL is unset', async () => {
    process.env.REDISCLOUD_URL = 'redis://fallback';

    await createService();

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://fallback',
      expect.any(Object),
    );
  });

  it('connects to localhost:6379 when no Redis variable is set', async () => {
    await createService();

    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 6379,
        password: undefined,
      }),
    );
  });
});
