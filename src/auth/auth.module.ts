import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthModule as LibsAuthModule } from '@libs/auth';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../../libs/auth/strategies/jwt.strategy';
import { UserLookupProviderImpl } from './providers/user-lookup.provider';
import { UsersService } from '../users/users.service';

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
