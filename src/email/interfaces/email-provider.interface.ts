import { SendEmailOptions, SendEmailResult } from './send-email-options.interface';

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}

