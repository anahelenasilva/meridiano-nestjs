import { User } from '../../../src/users/user.entity';

export interface UserLookupProvider {
  getUserByEmail(email: string, includePassword: boolean): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
}
