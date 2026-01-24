import { Test, TestingModule } from '@nestjs/testing';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

describe('EmailModule', () => {
  let module: TestingModule;
  let originalEnvState: {
    EMAIL_PROVIDER: { value: string; existed: boolean };
    MAILGUN_API_KEY: { value: string; existed: boolean };
    MAILGUN_DOMAIN: { value: string; existed: boolean };
  };

  beforeEach(async () => {
    originalEnvState = {
      EMAIL_PROVIDER: {
        value: process.env.EMAIL_PROVIDER ?? '',
        existed: 'EMAIL_PROVIDER' in process.env,
      },
      MAILGUN_API_KEY: {
        value: process.env.MAILGUN_API_KEY ?? '',
        existed: 'MAILGUN_API_KEY' in process.env,
      },
      MAILGUN_DOMAIN: {
        value: process.env.MAILGUN_DOMAIN ?? '',
        existed: 'MAILGUN_DOMAIN' in process.env,
      },
    };

    process.env.EMAIL_PROVIDER = 'mailgun';
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'test-domain.com';

    module = await Test.createTestingModule({
      imports: [EmailModule.forRoot()],
    }).compile();
  });

  afterEach(() => {
    if (originalEnvState.EMAIL_PROVIDER.existed) {
      process.env.EMAIL_PROVIDER = originalEnvState.EMAIL_PROVIDER.value;
    } else {
      delete process.env.EMAIL_PROVIDER;
    }

    if (originalEnvState.MAILGUN_API_KEY.existed) {
      process.env.MAILGUN_API_KEY = originalEnvState.MAILGUN_API_KEY.value;
    } else {
      delete process.env.MAILGUN_API_KEY;
    }

    if (originalEnvState.MAILGUN_DOMAIN.existed) {
      process.env.MAILGUN_DOMAIN = originalEnvState.MAILGUN_DOMAIN.value;
    } else {
      delete process.env.MAILGUN_DOMAIN;
    }
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide EmailService', () => {
    const service = module.get<EmailService>(EmailService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EmailService);
  });

  it('should export EmailService', () => {
    const service = module.get<EmailService>(EmailService);
    expect(service).toBeDefined();
  });
});
