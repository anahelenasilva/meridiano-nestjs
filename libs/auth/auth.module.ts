import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from '@libs/redis';
import { AuthService, USER_LOOKUP_PROVIDER_TOKEN } from './auth.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { RateLimitService } from './rate-limit/rate-limit.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

@Module({})
export class AuthModule {
  static forRoot(userLookupProvider: new () => UserLookupProvider): DynamicModule {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error('JWT_SECRET is required but not found in environment variables');
    }

    return {
      module: AuthModule,
      imports: [
        PassportModule,
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '24h' },
        }),
        RedisModule,
      ],
      providers: [
        {
          provide: USER_LOOKUP_PROVIDER_TOKEN,
          useClass: userLookupProvider,
        },
        AuthService,
        RateLimitService,
        RateLimitGuard,
      ],
      exports: [AuthService, RateLimitService, RateLimitGuard],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => UserLookupProvider | Promise<UserLookupProvider>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error('JWT_SECRET is required but not found in environment variables');
    }

    return {
      module: AuthModule,
      imports: [
        PassportModule,
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '24h' },
        }),
        RedisModule,
        ...(options.imports || []),
      ],
      providers: [
        {
          provide: USER_LOOKUP_PROVIDER_TOKEN,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        AuthService,
        RateLimitService,
        RateLimitGuard,
      ],
      exports: [AuthService, RateLimitService, RateLimitGuard],
    };
  }
}
