import { EmailService } from '@libs/email';
import { GenerateAudioJobData } from '@libs/queue/interfaces/audio-job.interface';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '../../config/config.service';

/**
 * Emails the audio support address once an Audio Generation Job has failed for
 * good. The audio worker passes `notify` to `createWorker` as
 * `onTerminalFailure`, so it never rejects.
 */
@Injectable()
export class AudioGenerationFailureNotifier {
  private readonly logger = new Logger(AudioGenerationFailureNotifier.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async notify(job: Job<GenerateAudioJobData>, err: Error): Promise<void> {
    const config = this.configService.getAudioFailureNotificationEmail();

    if (!config) {
      this.logger.warn(
        `Audio job ${job.id} failed after ${job.attemptsMade} attempts, but AUDIO_FAILURE_SUPPORT_EMAIL (and AUDIO_FAILURE_SUPPORT_EMAIL_FROM or ARTICLE_FAILURE_NOTIFICATION_EMAIL_FROM) is not configured.`,
      );
      return;
    }

    const { sourceType, sourceId } = job.data;

    try {
      await this.emailService.sendEmail({
        from: config.from,
        to: config.to,
        subject: 'Audio Generation Failed',
        text: `Audio generation job failed after ${job.attemptsMade} attempts.

Details:
- Job ID: ${job.id}
- Source Type: ${sourceType}
- Source ID: ${sourceId}
- Error: ${err.message || 'Unknown error'}
- Timestamp: ${new Date().toISOString()}

Please investigate the issue.`,
      });

      this.logger.log(
        `Audio failure notification email sent to ${config.to} for job ${job.id}`,
      );
    } catch (emailError) {
      this.logger.error(
        `Failed to send audio failure notification email for job ${job.id}:`,
        emailError instanceof Error ? emailError.message : String(emailError),
      );
    }
  }
}
