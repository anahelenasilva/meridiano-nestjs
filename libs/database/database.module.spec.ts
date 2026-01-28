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
  const { DataSource } = require('typeorm');
  const MockTypeOrmModule = class {} as any;
  MockTypeOrmModule.forRoot = jest.fn(() => ({
    module: MockTypeOrmModule,
    providers: [
      {
        provide: DataSource,
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
  const mockDatabaseService = {
    initDb: jest.fn().mockResolvedValue(undefined),
    getDbConnection: jest.fn(),
    closeDb: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };
  const mockDataSource = mock<DataSource>();

  beforeEach(async () => {
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
