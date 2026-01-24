import { Test, TestingModule } from '@nestjs/testing';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

describe('EmailModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    const originalEnv = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = 'mailgun';
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'test-domain.com';

    module = await Test.createTestingModule({
      imports: [EmailModule.forRoot()],
    }).compile();

    if (originalEnv) {
      process.env.EMAIL_PROVIDER = originalEnv;
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
