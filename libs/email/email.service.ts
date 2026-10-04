import { Injectable } from '@nestjs/common';
import FormData from 'form-data';
import Mailgun, { Interfaces } from 'mailgun.js';
import { ConfigService } from '../../src/config/config.service';
import {
  SendEmailOptions,
  SendEmailResult,
} from './interfaces/send-email-options.interface';

@Injectable()
export class EmailService {
  private readonly client: Interfaces.IMailgunClient;
  private readonly domain: string;

  constructor(configService: ConfigService) {
    // For EU domains, set MAILGUN_URL=https://api.eu.mailgun.net
    const { apiKey, domain, url } = configService.getMailgunConfig();

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY environment variable is required');
    }

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN environment variable is required');
    }

    this.domain = domain;
    this.client = new Mailgun(FormData).client({
      username: 'api',
      key: apiKey,
      url,
    });
  }

  async sendEmail({
    from,
    to,
    cc,
    subject,
    text,
  }: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const data = await this.client.messages.create(this.domain, {
        from,
        to,
        cc,
        subject,
        text,
      });

      return { success: true, messageId: data.id };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send email via Mailgun',
      };
    }
  }
}
