import { NEWS_DIGEST_JOB, NEWS_DIGEST_QUEUE } from '@libs/queue/constants/queue.constants';
import { createWorker } from '@libs/queue/create-worker';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestsService } from './digests.service';
import { DigestItem } from './entities/digest.types';

@Injectable()
export class NewsDigestService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(NewsDigestService.name);

  constructor(
    @Inject(NEWS_DIGEST_QUEUE)
    private readonly queue: Queue,
    private readonly articlesService: ArticlesService,
    private readonly digestArticleSelectorService: DigestArticleSelectorService,
    private readonly digestsService: DigestsService,
  ) {}

  onModuleInit() {
    this.seedRepeatableJob().catch((err: Error) => {
      this.logger.error('Failed to seed news digest repeatable job', err.stack);
    });

    this.worker = createWorker(this.queue, () => this.runDigest(), {
      logger: this.logger,
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
  }
}
