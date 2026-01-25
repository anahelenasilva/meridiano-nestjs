import { Injectable } from '@nestjs/common';
import { UserLookupProvider } from '@libs/auth/interfaces/user-lookup-provider.interface';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class UserLookupProviderImpl implements UserLookupProvider {
  constructor(private readonly usersService: UsersService) {}

  async getUserByEmail(email: string, includePassword: boolean): Promise<User | null> {
    return this.usersService.getUserByEmail(email, includePassword);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.usersService.getUserById(userId);
  }
}
