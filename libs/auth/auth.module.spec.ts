import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

class MockUserLookupProvider implements UserLookupProvider {
  async getUserByEmail() {
    return null;
  }

  async getUserById() {
    return null;
  }
}

describe('AuthModule', () => {
  let module: TestingModule;
  let originalEnvState: {
    JWT_SECRET: { value: string; existed: boolean };
  };

  beforeEach(async () => {
    originalEnvState = {
      JWT_SECRET: {
        value: process.env.JWT_SECRET ?? '',
        existed: 'JWT_SECRET' in process.env,
      },
    };

    process.env.JWT_SECRET = 'test-secret-key';

    module = await Test.createTestingModule({
      imports: [AuthModule.forRoot(MockUserLookupProvider)],
    }).compile();
  });

  afterEach(() => {
    if (originalEnvState.JWT_SECRET.existed) {
      process.env.JWT_SECRET = originalEnvState.JWT_SECRET.value;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuthService', () => {
    const service = module.get<AuthService>(AuthService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AuthService);
  });

  it('should export AuthService', () => {
    const service = module.get<AuthService>(AuthService);
    expect(service).toBeDefined();
  });
});
