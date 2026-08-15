import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '../../src/config/config.service';
import { EmailService, EMAIL_PROVIDER_TOKEN } from './email.service';
import { EmailProvider } from './interfaces/email-provider.interface';
import { MailgunProvider } from './providers/mailgun.provider';

@Module({})
export class EmailModule {
  // The provider class is picked at module-composition time (before Nest's
  // DI container exists), so this one read of EMAIL_PROVIDER can't go
  // through ConfigService. The secrets each provider needs (Mailgun's API
  // key/domain/url) do go through ConfigService, in MailgunProvider.
  static forRoot(): DynamicModule {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';

    let emailProviderClass: new (configService: ConfigService) => EmailProvider;

    switch (provider.toLowerCase()) {
      case 'mailgun':
        emailProviderClass = MailgunProvider;
        break;
      // Add more providers here in the future
      // case 'sendgrid':
      //   emailProviderClass = SendgridProvider;
      //   break;
      // case 'ses':
      //   emailProviderClass = SesProvider;
      //   break;
      default:
        throw new Error(
          `Unsupported email provider: ${provider}. Supported providers: mailgun`,
        );
    }

    return {
      module: EmailModule,
      // No ConfigModule import: ConfigService is @Global() (registered once
      // via AppModule); importing ConfigModule here risks the same require()
      // cycle documented in redis.module.ts.
      providers: [
        {
          provide: EMAIL_PROVIDER_TOKEN,
          useClass: emailProviderClass,
        },
        EmailService,
      ],
      exports: [EmailService],
    };
  }
}

