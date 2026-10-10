import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Mailgun from 'mailgun.js';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

jest.mock('mailgun.js');

// Stands in for the app's ConfigService, which reaches EmailModule through the
// app's @Global() ConfigModule. Async to cover factories that return a Promise.
class AppConfig {
  getMailgunConfig() {
    return Promise.resolve({
      apiKey: 'app-key',
      domain: 'app-domain.com',
      url: 'https://api.eu.mailgun.net',
    });
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
class GlobalAppConfigModule {}

describe('EmailModule', () => {
  const mailgunClient = jest
    .fn()
    .mockReturnValue({ messages: { create: jest.fn() } });

  beforeEach(() => {
    jest
      .mocked(Mailgun)
      .mockImplementation(
        () => ({ client: mailgunClient }) as unknown as Mailgun,
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds the Mailgun client from the config its factory resolves', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [
        GlobalAppConfigModule,
        EmailModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (config) => config.getMailgunConfig(),
        }),
      ],
    }).compile();

    expect(testingModule.get(EmailService)).toBeInstanceOf(EmailService);
    expect(mailgunClient).toHaveBeenCalledWith({
      username: 'api',
      key: 'app-key',
      url: 'https://api.eu.mailgun.net',
    });
  });

  // Compile-time check, enforced by `pnpm typecheck`: noImplicitAny is off in
  // this repo, so a factory typed `(...args: any[])` would accept any argument
  // type.
  it('types the factory arguments from inject', () => {
    EmailModule.forRootAsync({
      inject: [AppConfig],
      // @ts-expect-error inject hands the factory an AppConfig, not a string
      useFactory: (config: string) => ({ apiKey: config, domain: config }),
    });
  });
});
