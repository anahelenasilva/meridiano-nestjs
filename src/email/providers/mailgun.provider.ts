import { Injectable } from '@nestjs/common';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

import { EmailProvider } from '../interfaces/email-provider.interface';
import { SendEmailOptions, SendEmailResult } from '../interfaces/send-email-options.interface';

@Injectable()
export class MailgunProvider implements EmailProvider {
  private client: any;
  private domain: string;

  constructor() {
    const mailgun = new Mailgun(FormData);
    const apiKey = process.env.MAILGUN_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY or API_KEY environment variable is required');
    }

    const domain = process.env.MAILGUN_DOMAIN;

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN environment variable is required');
    }

    this.domain = domain;

    const clientConfig: any = {
      username: 'api',
      key: apiKey,
    };

    // For EU domains, set MAILGUN_URL=https://api.eu.mailgun.net
    if (process.env.MAILGUN_URL) {
      clientConfig.url = process.env.MAILGUN_URL;
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
      };

      if (options.text) {
        mailgunOptions.text = options.text;
      }

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

