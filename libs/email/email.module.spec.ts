import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import { EmailModule } from './email.module';
import { EmailService, EMAIL_PROVIDER_TOKEN } from './email.service';
import { MailgunProvider } from './providers/mailgun.provider';

describe('EmailModule', () => {
  let originalEnvState: {
    EMAIL_PROVIDER: { value: string; existed: boolean };
  };

  beforeEach(() => {
    originalEnvState = {
      EMAIL_PROVIDER: {
        value: process.env.EMAIL_PROVIDER ?? '',
        existed: 'EMAIL_PROVIDER' in process.env,
      },
    };
  });

  afterEach(() => {
    if (originalEnvState.EMAIL_PROVIDER.existed) {
      process.env.EMAIL_PROVIDER = originalEnvState.EMAIL_PROVIDER.value;
    } else {
      delete process.env.EMAIL_PROVIDER;
    }
  });

  describe('forRoot', () => {
    it('wires EMAIL_PROVIDER_TOKEN to MailgunProvider by default', () => {
      delete process.env.EMAIL_PROVIDER;

      const dynamicModule = EmailModule.forRoot();

      expect(dynamicModule.providers).toContainEqual(
        expect.objectContaining({
          provide: EMAIL_PROVIDER_TOKEN,
          useClass: MailgunProvider,
        }),
      );
      expect(dynamicModule.exports).toContain(EmailService);
    });

    it('throws for an unsupported provider', () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';

      expect(() => EmailModule.forRoot()).toThrow(
        'Unsupported email provider: sendgrid. Supported providers: mailgun',
      );
    });
  });

  describe('DI wiring', () => {
    let testingModule: TestingModule;
    const mockConfigService = mock<ConfigService>();

    beforeEach(async () => {
      mockConfigService.getMailgunConfig.mockReturnValue({
        apiKey: 'test-key',
        domain: 'test-domain.com',
        url: undefined,
      });

      testingModule = await Test.createTestingModule({
        providers: [
          { provide: EMAIL_PROVIDER_TOKEN, useClass: MailgunProvider },
          { provide: ConfigService, useValue: mockConfigService },
          EmailService,
        ],
      }).compile();
    });

    it('provides EmailService backed by MailgunProvider using ConfigService secrets', () => {
      const service = testingModule.get<EmailService>(EmailService);
      expect(service).toBeInstanceOf(EmailService);
      expect(mockConfigService.getMailgunConfig).toHaveBeenCalled();
    });
  });
});
