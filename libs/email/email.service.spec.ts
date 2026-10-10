import Mailgun from 'mailgun.js';
import { EmailService } from './email.service';
import { MailgunConfig } from './interfaces/mailgun-config.interface';
import { SendEmailOptions } from './interfaces/send-email-options.interface';

jest.mock('mailgun.js');

describe('EmailService', () => {
  const messagesCreate = jest.fn();
  const mailgunClient = jest
    .fn()
    .mockReturnValue({ messages: { create: messagesCreate } });

  const config: MailgunConfig = {
    apiKey: 'test-key',
    domain: 'test-domain.com',
    url: 'https://api.eu.mailgun.net',
  };

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('builds the Mailgun client from its config', () => {
      new EmailService(config);

      expect(mailgunClient).toHaveBeenCalledWith({
        username: 'api',
        key: 'test-key',
        url: 'https://api.eu.mailgun.net',
      });
    });

    it('passes no url when the config has none', () => {
      new EmailService({ apiKey: 'test-key', domain: 'test-domain.com' });

      expect(mailgunClient).toHaveBeenCalledWith({
        username: 'api',
        key: 'test-key',
        url: undefined,
      });
    });

    it.each(['', undefined])('throws when the API key is %p', (apiKey) => {
      expect(() => new EmailService({ ...config, apiKey })).toThrow(
        'MAILGUN_API_KEY environment variable is required',
      );
    });

    it.each(['', undefined])('throws when the domain is %p', (domain) => {
      expect(() => new EmailService({ ...config, domain })).toThrow(
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

      await new EmailService(config).sendEmail(options);

      expect(messagesCreate).toHaveBeenCalledWith('test-domain.com', options);
    });

    it('rejects with the Mailgun error', async () => {
      messagesCreate.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(new EmailService(config).sendEmail(options)).rejects.toThrow(
        'Forbidden',
      );
    });
  });
});
