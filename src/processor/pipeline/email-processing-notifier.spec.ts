import { EmailService } from '@libs/email';
import { mock } from 'jest-mock-extended';
import { DBArticle } from '../../articles/article.entity';
import { ConfigService } from '../../config/config.service';
import { EmailProcessingNotifier } from './email-processing-notifier';

function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'article-1',
    url: 'https://example.com/a',
    title: 'An Article',
    published_date: new Date('2026-01-01'),
    feed_source: 'Example Feed',
    raw_content: 'raw',
    feed_profile: 'general',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('EmailProcessingNotifier', () => {
  let emailService: ReturnType<typeof mock<EmailService>>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let notifier: EmailProcessingNotifier;

  beforeEach(() => {
    emailService = mock<EmailService>();
    configService = mock<ConfigService>();
    notifier = new EmailProcessingNotifier(emailService, configService);
  });

  it('sends an email to the configured recipient with step context', async () => {
    configService.getEmbeddingFailureNotificationEmail.mockReturnValue({
      to: 'ops@example.com',
      from: 'noreply@example.com',
    });

    await notifier.notifyFailure({
      article: makeArticle({ id: 'x', title: 'T', url: 'https://u' }),
      step: 'rate',
      error: 'boom',
    });

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const sent = emailService.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe('ops@example.com');
    expect(sent.from).toBe('noreply@example.com');
    expect(sent.subject).toContain('Impact rating');
    expect(sent.text).toContain('x');
    expect(sent.text).toContain('boom');
    expect(sent.text).toContain('rate');
  });

  it('does not send when no notification email is configured', async () => {
    configService.getEmbeddingFailureNotificationEmail.mockReturnValue(null);

    await notifier.notifyFailure({
      article: makeArticle(),
      step: 'summarise',
      error: 'boom',
    });

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('swallows email transport errors so the original failure is not masked', async () => {
    configService.getEmbeddingFailureNotificationEmail.mockReturnValue({
      to: 'ops@example.com',
      from: 'noreply@example.com',
    });
    emailService.sendEmail.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      notifier.notifyFailure({
        article: makeArticle(),
        step: 'categorise',
        error: 'boom',
      }),
    ).resolves.toBeUndefined();
  });
});
