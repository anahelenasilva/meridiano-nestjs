import { RedisService } from '@libs/redis';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { NEWS_DIGEST_JOB, NEWS_DIGEST_QUEUE } from '@libs/queue/constants/queue.constants';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestsService } from './digests.service';
import { DigestItem } from './entities/digest.types';

@Injectable()
export class NewsDigestService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;
  private readonly logger = new Logger(NewsDigestService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly articlesService: ArticlesService,
    private readonly digestArticleSelectorService: DigestArticleSelectorService,
    private readonly digestsService: DigestsService,
  ) {}

  onModuleInit() {
    const connection = this.redisService.getClient();

    // Retry options must live on defaultJobOptions: BullMQ ignores attempts/backoff
    // passed to add() for repeatable jobs.
    this.queue = new Queue(NEWS_DIGEST_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 600_000 },
      },
    });

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

  buildDigest(articles: DBArticle[]): DigestItem[] {
    return articles.map((article) => ({
      articleId: article.id ?? '',
      title: article.title ?? '',
      feedSource: article.feed_source ?? '',
      url: article.url ?? '',
    }));
  }

  async runDigest(): Promise<void> {
    const articles = await this.articlesService.getYesterdayArticlesByProfile();
    const selected = await this.digestArticleSelectorService.selectTopArticles(articles);

    if (selected.length === 0) {
      this.logger.log('No articles selected; skipping digest');
      return;
    }

    await this.digestsService.saveDigest(this.buildDigest(selected));
  }

  async getLatestDigest(): Promise<DigestItem[]> {
    const latest = await this.digestsService.findLatest();
    return latest?.items ?? [];
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
