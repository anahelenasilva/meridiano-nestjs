import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from '@libs/redis';
import { ConfigService } from '../../src/config/config.service';
import { AuthService, USER_LOOKUP_PROVIDER_TOKEN } from './auth.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { RateLimitService } from './rate-limit/rate-limit.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

// No ConfigModule import anywhere in this file: ConfigService is @Global()
// (registered once via AppModule). Importing ConfigModule here would create
// a require() cycle: ConfigModule -> YoutubeChannelsModule -> its controller
// -> @libs/auth (this file).
@Module({})
export class AuthModule {
  static forRoot(userLookupProvider: new () => UserLookupProvider): DynamicModule {
    return {
      module: AuthModule,
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
    return {
      module: AuthModule,
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
