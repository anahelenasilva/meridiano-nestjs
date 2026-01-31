import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database.module';
import { DatabaseService } from './database.service';

jest.mock('typeorm', () => {
  const mockDataSourceInstance = {
    runMigrations: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  return {
    DataSource: jest.fn().mockImplementation(() => mockDataSourceInstance),
  };
});

jest.mock('@nestjs/typeorm', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DataSource } = require('typeorm');
  const MockTypeOrmModule = class { } as any;
  MockTypeOrmModule.forRoot = jest.fn(() => ({
    module: MockTypeOrmModule,
    providers: [
      {
        provide: DataSource,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        useFactory: () => new DataSource({} as any),
      },
    ],
    exports: [MockTypeOrmModule, DataSource],
    imports: [],
    controllers: [],
    global: true,
  }));
  return {
    TypeOrmModule: MockTypeOrmModule,
  };
});

describe('DatabaseModule', () => {
  let module: TestingModule;
  const mockDatabaseService = mock<DatabaseService>();
  const mockDataSource = mock<DataSource>();

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDatabaseService.initDb.mockResolvedValue(undefined);
    mockDatabaseService.closeDb.mockResolvedValue(undefined);
    mockDatabaseService.onModuleDestroy.mockResolvedValue(undefined);
    mockDataSource.runMigrations.mockResolvedValue([]);
    mockDataSource.destroy.mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    jest.clearAllMocks();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide DatabaseService', () => {
    const service = module.get<DatabaseService>(DatabaseService);
    expect(service).toBeDefined();
  });

  it('should export DatabaseService', () => {
    const service = module.get<DatabaseService>(DatabaseService);
    expect(service).toBeDefined();
  });
});
