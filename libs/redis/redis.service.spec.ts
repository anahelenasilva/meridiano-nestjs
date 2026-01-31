import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { mock } from 'jest-mock-extended';
import { RedisService } from './redis.service';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  const mockRedisClient = mock<Redis>();

  beforeEach(async () => {
    jest.clearAllMocks();

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize Redis client', () => {
    expect(Redis).toHaveBeenCalled();
  });

  it('should return Redis client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
  });
});
