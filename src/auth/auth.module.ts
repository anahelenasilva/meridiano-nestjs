import { JwtStrategy, AuthModule as LibsAuthModule } from '@libs/auth';
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { UserLookupProviderImpl } from './providers/user-lookup.provider';

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
