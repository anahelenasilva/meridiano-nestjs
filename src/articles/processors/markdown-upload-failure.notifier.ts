import { EmailService } from '@libs/email';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '../../config/config.service';
import { ProcessMarkdownArticleJobData } from '../services/article-jobs.service';

/**
 * Emails the article failure address once a markdown upload job has failed
 * for good. The markdown worker passes `notify` to `createWorker` as
 * `onTerminalFailure`, so it never rejects.
 */
@Injectable()
export class MarkdownUploadFailureNotifier {
  private readonly logger = new Logger(MarkdownUploadFailureNotifier.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async notify(
    job: Job<ProcessMarkdownArticleJobData>,
    err: Error,
  ): Promise<void> {
    const { failureNotificationEmail, failureNotificationEmailFrom } =
      this.configService.getArticleEmailsNotifications();

    if (!failureNotificationEmail || !failureNotificationEmailFrom) {
      this.logger.warn(
        `Job ${job.id} failed after ${job.attemptsMade} attempts, but no notification email is configured (ARTICLE_FAILURE_NOTIFICATION_EMAIL and ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM).`,
      );
      return;
    }

    const { s3Bucket, s3Key } = job.data;

    try {
      await this.emailService.sendEmail({
        from: failureNotificationEmailFrom,
        to: failureNotificationEmail,
        subject: 'Article Processing Failed',
        text: `Article processing failed after ${job.attemptsMade} attempts.

Details:
- S3 Bucket: ${s3Bucket}
- S3 Key: ${s3Key}
- Job ID: ${job.id}
- Error: ${err.message || 'Unknown error'}
- Timestamp: ${new Date().toISOString()}

Please investigate the issue.`,
      });

      this.logger.log(
        `Failure notification email sent to ${failureNotificationEmail} for job ${job.id}`,
      );
    } catch (emailError) {
      this.logger.error(
        `Failed to send notification email for job ${job.id}:`,
        emailError instanceof Error ? emailError.message : String(emailError),
      );
    }
  }
}
