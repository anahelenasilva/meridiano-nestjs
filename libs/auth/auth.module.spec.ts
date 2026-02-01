import { Test, TestingModule } from '@nestjs/testing';
import { User } from 'src/users/user.entity';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

class MockUserLookupProvider implements UserLookupProvider {
  getUserById(userId: string): Promise<User | null> {
    return Promise.resolve({
      id: userId,
      email: 'test@example.com',
      password: 'password',
      username: 'testuser',
      created_at: new Date(),
    });
  }

  getUserByEmail(email: string, includePassword: boolean): Promise<User | null> {
    return Promise.resolve({
      id: '1',
      email,
      password: includePassword ? 'password' : undefined,
      username: 'testuser',
      created_at: new Date(),
    });
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
