import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import { S3Module } from './s3.module';
import { S3Service } from './s3.service';

const mockConfigService = mock<ConfigService>();

// S3Module relies on the real app's ConfigModule being @Global() (it doesn't
// import ConfigModule itself, to avoid a require() cycle through
// YoutubeChannelsModule). Stand in a global mock so S3Service can still
// resolve ConfigService in this isolated test module.
@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: mockConfigService }],
  exports: [ConfigService],
})
class MockConfigModule {}

describe('S3Module', () => {
  let module: TestingModule;

  beforeEach(async () => {
    mockConfigService.getAwsConfig.mockReturnValue({
      accessKeyId: undefined,
      secretAccessKey: undefined,
      credentials: undefined,
      region: 'us-east-1',
    });

    module = await Test.createTestingModule({
      imports: [MockConfigModule, S3Module],
    }).compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide S3Service', () => {
    const service = module.get<S3Service>(S3Service);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(S3Service);
  });

  it('should export S3Service', () => {
    const service = module.get<S3Service>(S3Service);
    expect(service).toBeDefined();
  });
});
