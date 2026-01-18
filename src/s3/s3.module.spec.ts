import { Test, TestingModule } from '@nestjs/testing';
import { S3Module } from './s3.module';
import { S3Service } from './s3.service';

describe('S3Module', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [S3Module],
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
