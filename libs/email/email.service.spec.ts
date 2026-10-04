import { mock } from 'jest-mock-extended';
import Mailgun from 'mailgun.js';
import { ConfigService } from '../../src/config/config.service';
import { EmailService } from './email.service';
import { SendEmailOptions } from './interfaces/send-email-options.interface';

jest.mock('mailgun.js');

describe('EmailService', () => {
  const messagesCreate = jest.fn();
  const mailgunClient = jest
    .fn()
    .mockReturnValue({ messages: { create: messagesCreate } });
  const configService = mock<ConfigService>();

  const options: SendEmailOptions = {
    from: 'test@example.com',
    to: ['recipient@example.com'],
    cc: 'copy@example.com',
    subject: 'Test Subject',
    text: 'Test body',
  };

  beforeEach(() => {
    jest
      .mocked(Mailgun)
      .mockImplementation(
        () => ({ client: mailgunClient }) as unknown as Mailgun,
      );
    configService.getMailgunConfig.mockReturnValue({
      apiKey: 'test-key',
      domain: 'test-domain.com',
      url: 'https://api.eu.mailgun.net',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('builds the Mailgun client from ConfigService', () => {
      new EmailService(configService);

      expect(mailgunClient).toHaveBeenCalledWith({
        username: 'api',
        key: 'test-key',
        url: 'https://api.eu.mailgun.net',
      });
    });

    it('throws without MAILGUN_API_KEY', () => {
      configService.getMailgunConfig.mockReturnValue({
        apiKey: undefined,
        domain: 'test-domain.com',
        url: undefined,
      });

      expect(() => new EmailService(configService)).toThrow(
        'MAILGUN_API_KEY environment variable is required',
      );
    });

    it('throws without MAILGUN_DOMAIN', () => {
      configService.getMailgunConfig.mockReturnValue({
        apiKey: 'test-key',
        domain: undefined,
        url: undefined,
      });

      expect(() => new EmailService(configService)).toThrow(
        'MAILGUN_DOMAIN environment variable is required',
      );
    });
  });

  describe('sendEmail', () => {
    it('sends through Mailgun on the configured domain', async () => {
      messagesCreate.mockResolvedValueOnce({
        id: 'test-message-id',
        status: 200,
      });

      const result = await new EmailService(configService).sendEmail(options);

      expect(messagesCreate).toHaveBeenCalledWith('test-domain.com', options);
      expect(result).toEqual({ success: true, messageId: 'test-message-id' });
    });

    it('returns the Mailgun error instead of throwing', async () => {
      messagesCreate.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await new EmailService(configService).sendEmail(options);

      expect(result).toEqual({ success: false, error: 'Forbidden' });
    });
  });
});
