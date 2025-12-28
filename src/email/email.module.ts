import { Module, DynamicModule } from '@nestjs/common';
import { EmailService, EMAIL_PROVIDER_TOKEN } from './email.service';
import { EmailProvider } from './interfaces/email-provider.interface';
import { MailgunProvider } from './providers/mailgun.provider';

@Module({})
export class EmailModule {
  static forRoot(): DynamicModule {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';
    
    let emailProviderClass: new () => EmailProvider;
    
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

