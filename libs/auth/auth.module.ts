import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService, USER_LOOKUP_PROVIDER_TOKEN } from './auth.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

@Module({})
export class AuthModule {
  static forRoot(userLookupProvider: new () => UserLookupProvider): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        PassportModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '24h' },
        }),
      ],
      providers: [
        {
          provide: USER_LOOKUP_PROVIDER_TOKEN,
          useClass: userLookupProvider,
        },
        AuthService,
      ],
      exports: [AuthService],
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
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '24h' },
        }),
        ...(options.imports || []),
      ],
      providers: [
        {
          provide: USER_LOOKUP_PROVIDER_TOKEN,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        AuthService,
      ],
      exports: [AuthService],
    };
  }
}
