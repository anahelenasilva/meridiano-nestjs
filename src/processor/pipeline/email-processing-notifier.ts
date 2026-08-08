import { EmailService } from '@libs/email';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  ProcessingFailureNotification,
  ProcessingNotifier,
} from './processing-notifier';

const STEP_LABELS: Record<ProcessingFailureNotification['step'], string> = {
  summarise: 'Summary generation',
  rate: 'Impact rating',
  categorise: 'Categorisation',
};

@Injectable()
export class EmailProcessingNotifier implements ProcessingNotifier {
  private readonly logger = new Logger(EmailProcessingNotifier.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async notifyFailure({
    article,
    step,
    error,
  }: ProcessingFailureNotification): Promise<void> {
    const emailConfig = this.configService.getEmbeddingFailureNotificationEmail();

    if (!emailConfig) {
      this.logger.warn(
        `Article ${article.id} failed at ${step} step, but no failure-notification email is configured (set EMBEDDING_FAILURE_NOTIFICATION_EMAIL and a *_FROM address).`,
      );
      return;
    }

    const label = STEP_LABELS[step];

    try {
      await this.emailService.sendEmail({
        from: emailConfig.from,
        to: emailConfig.to,
        subject: `Article Processing Failed: ${label}`,
        text: `${label} failed for an article during processing.

Details:
- Article ID: ${article.id}
- Article Title: ${article.title}
- Article URL: ${article.url}
- Failed step: ${step}
- Error: ${error}
- Timestamp: ${new Date().toISOString()}`,
      });

      this.logger.log(
        `Failure notification email sent to ${emailConfig.to} for article ${article.id} (${step}).`,
      );
    } catch (emailError) {
      // A failing notifier must not mask the original processing failure.
      this.logger.error(
        `Failed to send failure-notification email for article ${article.id}:`,
        emailError instanceof Error ? emailError.message : String(emailError),
      );
    }
  }
}
