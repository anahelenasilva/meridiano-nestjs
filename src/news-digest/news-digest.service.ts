import { EmailService } from '@libs/email';
import { RedisService } from '@libs/redis';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { NEWS_DIGEST_JOB, NEWS_DIGEST_QUEUE } from '@libs/queue/constants/queue.constants';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestEmailComposerService } from './digest-email-composer.service';

@Injectable()
export class NewsDigestService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;
  private readonly logger = new Logger(NewsDigestService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly articlesService: ArticlesService,
    private readonly digestArticleSelectorService: DigestArticleSelectorService,
    private readonly digestEmailComposerService: DigestEmailComposerService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const connection = this.redisService.getClient();

    this.queue = new Queue(NEWS_DIGEST_QUEUE, { connection });

    this.seedRepeatableJob().catch((err: Error) => {
      this.logger.error('Failed to seed news digest repeatable job', err.stack);
    });

    this.worker = new Worker(NEWS_DIGEST_QUEUE, () => this.runDigest(), { connection });

    this.worker.on('completed', (job) => {
      this.logger.log(`News digest job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.handleFailedJob(job, err);
    });

    this.worker.on('error', (err: Error) => {
      if (err.message?.includes('ECONNRESET') || err.message?.includes('closed')) {
        this.logger.debug(`News digest worker connection error: ${err.message}`);
        return;
      }
      this.logger.error('News digest worker error', err.stack);
    });

    this.logger.log('News digest worker initialized');
  }

  private async seedRepeatableJob(): Promise<void> {
    await this.queue.add(
      NEWS_DIGEST_JOB,
      {},
      {
        repeat: { pattern: '0 10 * * *' },
        attempts: 2,
        backoff: { type: 'fixed', delay: 600_000 },
      },
    );
    this.logger.log('News digest repeatable job seeded at 10:00 UTC daily');
  }

  private handleFailedJob(job: Job | undefined, err: Error): void {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 1;
    const jobId = job?.id ?? 'unknown';

    if (attemptsMade >= maxAttempts) {
      this.logger.error(
        `News digest job ${jobId} failed after ${attemptsMade}/${maxAttempts} attempts`,
        err.stack,
      );
      return;
    }

    this.logger.warn(
      `News digest job ${jobId} failed attempt ${attemptsMade}/${maxAttempts}; retry scheduled: ${err.message}`,
    );
  }

  async runDigest(): Promise<void> {
    const articles = await this.articlesService.getYesterdayArticlesByProfile();
    const selected = await this.digestArticleSelectorService.selectTopArticles(articles);

    if (selected.length === 0) {
      this.logger.log('No articles selected; skipping digest email');
      return;
    }

    const body = this.digestEmailComposerService.compose(selected);
    await this.emailService.sendEmail({
      from: this.configService.getNewsDigestFromEmail(),
      to: this.configService.getNewsDigestToEmail(),
      subject: 'Daily News Digest',
      text: body,
    });

    this.logger.log(`Digest email sent to ${this.configService.getNewsDigestToEmail()}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
