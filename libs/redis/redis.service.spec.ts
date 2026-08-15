import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import { RedisService } from './redis.service';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let moduleRef: TestingModule;
  const mockRedisClient = mock<Redis>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    jest.clearAllMocks();

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisClient);

    mockConfigService.getRedisConfig.mockReturnValue({
      url: undefined,
      host: 'localhost',
      port: 6379,
      password: undefined,
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    await moduleRef.init();

    service = moduleRef.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    await moduleRef.close();
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
