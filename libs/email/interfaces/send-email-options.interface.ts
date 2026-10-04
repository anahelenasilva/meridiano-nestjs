export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  cc?: string | string[];
}

