import { User } from 'src/users/user.entity';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

class MockUserLookupProvider implements UserLookupProvider {
  getUserById(userId: string): Promise<User | null> {
    return Promise.resolve({
      id: userId,
      email: 'test@example.com',
      password: 'password',
      username: 'testuser',
      isEmailVerified: true,
      created_at: new Date(),
    });
  }

  getUserByEmail(email: string, includePassword: boolean): Promise<User | null> {
    return Promise.resolve({
      id: '1',
      email,
      password: includePassword ? 'password' : undefined,
      username: 'testuser',
      isEmailVerified: true,
      created_at: new Date(),
    });
  }
}

describe('AuthModule', () => {
  it('should have mock user lookup provider interface implemented', () => {
    const provider = new MockUserLookupProvider();
    expect(provider.getUserById).toBeDefined();
    expect(provider.getUserByEmail).toBeDefined();
  });

  it('should have isEmailVerified field in user', async () => {
    const provider = new MockUserLookupProvider();
    const user = await provider.getUserById('test-id');
    expect(user).toBeDefined();
    expect(user?.isEmailVerified).toBe(true);
  });
});
