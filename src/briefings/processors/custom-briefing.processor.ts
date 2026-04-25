import { RedisService } from '@libs/redis';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { CUSTOM_BRIEFING_GENERATION_QUEUE } from '../../../libs/queue/constants/queue.constants';
import { CustomBriefingJobData } from '../../../libs/queue/interfaces/custom-briefing-job.interface';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';

@Injectable()
export class CustomBriefingProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly briefingGenerationService: BriefingGenerationService,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      CUSTOM_BRIEFING_GENERATION_QUEUE,
      async (job: Job<CustomBriefingJobData>) => {
        return await this.processCustomBriefing(job);
      },
      {
        connection: this.redisService.getClient(),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Custom briefing job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Custom briefing job ${job?.id} failed with error:`, err);
    });

    this.worker.on('error', (err: Error) => {
      if (err.message?.includes('ECONNRESET') || err.message?.includes('closed')) {
        return;
      }
      console.error('Custom briefing processor worker error:', err);
    });

    console.log('Custom briefing processor worker initialized');
  }

  async processCustomBriefing(
    job: Job<CustomBriefingJobData>,
  ): Promise<{ briefingId: string }> {
    const { articleIds, feedProfile, customPrompt } = job.data;

    console.log(
      `\n>>> Processing custom briefing (Job ${job.id}) for profile ${feedProfile} with ${articleIds.length} articles <<<`,
    );

    const result = await this.briefingGenerationService.generateCustomBrief(
      articleIds,
      feedProfile as FeedProfile,
      customPrompt,
    );

    if (!result.success || !result.briefingId) {
      throw new Error(result.error || 'Failed to generate custom briefing');
    }

    return { briefingId: result.briefingId };
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
