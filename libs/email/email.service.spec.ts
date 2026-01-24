import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { EmailProvider } from './interfaces/email-provider.interface';
import { SendEmailOptions, SendEmailResult } from './interfaces/send-email-options.interface';
import { EMAIL_PROVIDER_TOKEN, EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  const mockEmailProvider = mock<EmailProvider>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EMAIL_PROVIDER_TOKEN,
          useValue: mockEmailProvider,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should delegate to email provider', async () => {
      const options: SendEmailOptions = {
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test body',
      };

      const expectedResult: SendEmailResult = {
        success: true,
        messageId: 'test-message-id',
      };

      mockEmailProvider.sendEmail.mockResolvedValueOnce(expectedResult);

      const result = await service.sendEmail(options);

      expect(result).toEqual(expectedResult);
      expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(options);
      expect(mockEmailProvider.sendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
