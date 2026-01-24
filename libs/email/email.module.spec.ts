import { Test, TestingModule } from '@nestjs/testing';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

describe('EmailModule', () => {
  let module: TestingModule;
  let originalEmailProvider: string | undefined;
  let originalMailgunApiKey: string | undefined;
  let originalMailgunDomain: string | undefined;

  beforeEach(async () => {
    originalEmailProvider = process.env.EMAIL_PROVIDER;
    originalMailgunApiKey = process.env.MAILGUN_API_KEY;
    originalMailgunDomain = process.env.MAILGUN_DOMAIN;

    process.env.EMAIL_PROVIDER = 'mailgun';
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'test-domain.com';

    module = await Test.createTestingModule({
      imports: [EmailModule.forRoot()],
    }).compile();
  });

  afterEach(() => {
    if (originalEmailProvider !== undefined) {
      process.env.EMAIL_PROVIDER = originalEmailProvider;
    } else {
      delete process.env.EMAIL_PROVIDER;
    }

    if (originalMailgunApiKey !== undefined) {
      process.env.MAILGUN_API_KEY = originalMailgunApiKey;
    } else {
      delete process.env.MAILGUN_API_KEY;
    }

    if (originalMailgunDomain !== undefined) {
      process.env.MAILGUN_DOMAIN = originalMailgunDomain;
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
