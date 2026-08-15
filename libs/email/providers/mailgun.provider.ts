import { Injectable } from '@nestjs/common';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

import { ConfigService } from '../../../src/config/config.service';
import { EmailProvider } from '../interfaces/email-provider.interface';
import { SendEmailOptions, SendEmailResult } from '../interfaces/send-email-options.interface';

@Injectable()
export class MailgunProvider implements EmailProvider {
  private client: any;
  private domain: string;

  constructor(configService: ConfigService) {
    const mailgun = new Mailgun(FormData);
    const { apiKey, domain, url } = configService.getMailgunConfig();

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY environment variable is required');
    }

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN environment variable is required');
    }

    this.domain = domain;

    const clientConfig: any = {
      username: 'api',
      key: apiKey,
    };

    // For EU domains, set MAILGUN_URL=https://api.eu.mailgun.net
    if (url) {
      clientConfig.url = url;
    }

    this.client = mailgun.client(clientConfig);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      // Normalize recipients to array format
      const to = Array.isArray(options.to) ? options.to : [options.to];
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined;

      const mailgunOptions: any = {
        from: options.from,
        to,
        subject: options.subject,
        text: options.text
      };

      if (cc && cc.length > 0) {
        mailgunOptions.cc = cc;
      }

      const data = await this.client.messages.create(this.domain, mailgunOptions);

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via Mailgun',
      };
    }
  }
}

