/**
 * What the app hands `EmailModule.forRootAsync`. `apiKey` and `domain` admit
 * `undefined` so the app can pass raw env reads; `EmailService` throws at boot
 * when either is missing.
 */
export interface MailgunConfig {
  apiKey: string | undefined;
  domain: string | undefined;
  /** `https://api.eu.mailgun.net` for EU domains; Mailgun's US endpoint when unset. */
  url?: string;
}
