import { EmailService } from '@libs/email';
import { GenerateAudioJobData } from '@libs/queue/interfaces/audio-job.interface';
import { Job } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { AudioGenerationFailureNotifier } from './audio-generation-failure.notifier';

describe('AudioGenerationFailureNotifier', () => {
  const emailService = mock<EmailService>();
  const configService = mock<ConfigService>();
  const notifier = new AudioGenerationFailureNotifier(
    emailService,
    configService,
  );
  const job = {
    id: 'job-1',
    attemptsMade: 2,
    data: {
      sourceType: 'article',
      sourceId: 'a-1',
      text: 't',
      date: '2026-10-01',
    },
  } as Job<GenerateAudioJobData>;
  const err = new Error('boom');

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getAudioFailureNotificationEmail.mockReturnValue({
      to: 'ops@x.com',
      from: 'bot@x.com',
    });
  });

  it('sends the audio generation failure email with the attempts made', async () => {
    await notifier.notify(job, err);

    expect(emailService.sendEmail).toHaveBeenCalledWith({
      from: 'bot@x.com',
      to: 'ops@x.com',
      subject: 'Audio Generation Failed',
      text: expect.stringContaining(
        'Audio generation job failed after 2 attempts.',
      ),
    });
    const { text } = emailService.sendEmail.mock.calls[0][0];
    expect(text).toContain('- Source Type: article');
    expect(text).toContain('- Source ID: a-1');
    expect(text).toContain('- Error: boom');
  });

  it('warns and sends nothing when the support email is not configured', async () => {
    configService.getAudioFailureNotificationEmail.mockReturnValue(null);

    await notifier.notify(job, err);

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('resolves when the email send fails', async () => {
    emailService.sendEmail.mockRejectedValue(new Error('smtp down'));

    await expect(notifier.notify(job, err)).resolves.toBeUndefined();
  });
});
