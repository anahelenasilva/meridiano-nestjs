import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthModule as LibsAuthModule } from '../../libs/auth/auth.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import type { UserLookupProvider } from '../../libs/auth/interfaces/user-lookup-provider.interface';

class UserLookupProviderImpl implements UserLookupProvider {
  constructor(private readonly usersService: UsersService) {}

  async getUserByEmail(email: string, includePassword: boolean) {
    return this.usersService.getUserByEmail(email, includePassword);
  }

  async getUserById(userId: string) {
    return this.usersService.getUserById(userId);
  }
}

@Module({
  imports: [
    UsersModule,
    LibsAuthModule.forRootAsync({
      imports: [UsersModule],
      useFactory: (usersService: UsersService) => {
        return new UserLookupProviderImpl(usersService);
      },
      inject: [UsersService],
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy],
})
export class AuthModule {}
