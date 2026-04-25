import { RedisService } from '@libs/redis';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { CUSTOM_BRIEFING_GENERATION_QUEUE } from '../../../libs/queue/constants/queue.constants';
import { CustomBriefingJobData } from '../../../libs/queue/interfaces/custom-briefing-job.interface';
import { ConfigService } from '../../config/config.service';
import { BriefingGenerationService } from '../services/briefing-generation.service';

@Injectable()
export class CustomBriefingProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(CustomBriefingProcessor.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly briefingGenerationService: BriefingGenerationService,
    private readonly configService: ConfigService,
  ) { }

  onModuleInit() {
    const { concurrency } = this.configService.getCustomBriefingQueueConfig();

    this.worker = new Worker(
      CUSTOM_BRIEFING_GENERATION_QUEUE,
      async (job: Job<CustomBriefingJobData>) => {
        return await this.processCustomBriefing(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Custom briefing job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.handleFailedJob(job, err);
    });

    this.worker.on('error', (err: Error) => {
      if (err.message?.includes('ECONNRESET') || err.message?.includes('closed')) {
        return;
      }
      this.logger.error('Custom briefing processor worker error', err.stack);
    });

    this.logger.log(
      `Custom briefing processor worker initialized with concurrency ${concurrency}`,
    );
  }

  private handleFailedJob(
    job: Job<CustomBriefingJobData> | undefined,
    err: Error,
  ): void {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 1;
    const jobId = job?.id ?? 'unknown';

    if (attemptsMade >= maxAttempts) {
      this.logger.error(
        `Custom briefing job ${jobId} failed after ${attemptsMade}/${maxAttempts} attempts`,
        err.stack,
      );
      return;
    }

    this.logger.warn(
      `Custom briefing job ${jobId} failed attempt ${attemptsMade}/${maxAttempts}; retry scheduled: ${err.message}`,
    );
  }

  async processCustomBriefing(
    job: Job<CustomBriefingJobData>,
  ): Promise<{ briefingId: string; customTitle: string | null }> {
    const { articleIds, feedProfile, customPrompt } = job.data;

    this.logger.log(
      `\n>>> Processing custom briefing (Job ${job.id}) for profile ${feedProfile} with ${articleIds.length} articles <<<`,
    );

    const result = await this.briefingGenerationService.generateCustomBrief(
      articleIds,
      feedProfile,
      customPrompt,
    );

    if (!result.success || !result.briefingId) {
      throw new Error(result.error || 'Failed to generate custom briefing');
    }

    return {
      briefingId: result.briefingId,
      customTitle: result.customTitle ?? null,
    };
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
