import { EmailService } from '@libs/email';
import { Job } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { ProcessMarkdownArticleJobData } from '../services/article-jobs.service';
import { MarkdownUploadFailureNotifier } from './markdown-upload-failure.notifier';

describe('MarkdownUploadFailureNotifier', () => {
  const emailService = mock<EmailService>();
  const configService = mock<ConfigService>();
  const notifier = new MarkdownUploadFailureNotifier(
    emailService,
    configService,
  );
  const job = {
    id: 'job-1',
    attemptsMade: 3,
    data: {
      s3Bucket: 'bucket',
      s3Key: 'key.md',
      feedProfile: FeedProfile.DEFAULT,
    },
  } as Job<ProcessMarkdownArticleJobData>;
  const err = new Error('boom');

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getArticleEmailsNotifications.mockReturnValue({
      failureNotificationEmail: 'ops@x.com',
      failureNotificationEmailFrom: 'bot@x.com',
    });
  });

  it('sends the article processing failure email with the attempts made', async () => {
    await notifier.notify(job, err);

    expect(emailService.sendEmail).toHaveBeenCalledWith({
      from: 'bot@x.com',
      to: 'ops@x.com',
      subject: 'Article Processing Failed',
      text: expect.stringContaining(
        'Article processing failed after 3 attempts.',
      ),
    });
    const { text } = emailService.sendEmail.mock.calls[0][0];
    expect(text).toContain('- S3 Bucket: bucket');
    expect(text).toContain('- S3 Key: key.md');
    expect(text).toContain('- Job ID: job-1');
    expect(text).toContain('- Error: boom');
  });

  it('warns and sends nothing when either address is missing', async () => {
    configService.getArticleEmailsNotifications.mockReturnValue({
      failureNotificationEmail: 'ops@x.com',
      failureNotificationEmailFrom: '',
    });

    await notifier.notify(job, err);

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('resolves when the email send fails', async () => {
    emailService.sendEmail.mockRejectedValue(new Error('smtp down'));

    await expect(notifier.notify(job, err)).resolves.toBeUndefined();
  });
});
