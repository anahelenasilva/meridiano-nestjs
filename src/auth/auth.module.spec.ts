import 'reflect-metadata';
import { USER_LOOKUP_PROVIDER_TOKEN } from '@libs/auth';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { UsersService } from '../users/users.service';
import { AuthModule } from './auth.module';

function userLookupProvider(): FactoryProvider {
  const imports = Reflect.getMetadata('imports', AuthModule) as unknown[];
  const libsAuth = imports.find(
    (imported): imported is DynamicModule =>
      typeof imported === 'object' && imported !== null && 'module' in imported,
  );

  const provider = libsAuth?.providers?.find(
    (candidate): candidate is FactoryProvider =>
      typeof candidate === 'object' &&
      'provide' in candidate &&
      candidate.provide === USER_LOOKUP_PROVIDER_TOKEN,
  );

  if (!provider) {
    throw new Error(`AuthModule binds no ${USER_LOOKUP_PROVIDER_TOKEN}`);
  }

  return provider;
}

describe('AuthModule user lookup', () => {
  it('binds UsersService itself as the user lookup', () => {
    const provider = userLookupProvider();
    const usersService = mock<UsersService>();

    expect(provider.inject).toEqual([UsersService]);
    expect(provider.useFactory(usersService)).toBe(usersService);
  });
});
