export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  cc?: string | string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

