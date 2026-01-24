import { Inject, Injectable } from '@nestjs/common';
import type { EmailProvider } from './interfaces/email-provider.interface';
import { SendEmailOptions, SendEmailResult } from './interfaces/send-email-options.interface';

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: EmailProvider,
  ) { }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.emailProvider.sendEmail(options);
  }
}

