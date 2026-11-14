import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '../config/config.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getJwtSecret(),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RateLimitService, RateLimitGuard],
})
export class AuthModule {}
