import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { CUSTOM_BRIEFING_GENERATION_QUEUE } from '../../../libs/queue/constants/queue.constants';
import { createWorker } from '../../../libs/queue/create-worker';
import { CustomBriefingJobData } from '../../../libs/queue/interfaces/custom-briefing-job.interface';
import { ConfigService } from '../../config/config.service';
import { BriefingGenerationService } from '../services/briefing-generation.service';

@Injectable()
export class CustomBriefingProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(CustomBriefingProcessor.name);

  constructor(
    @Inject(CUSTOM_BRIEFING_GENERATION_QUEUE)
    private readonly queue: Queue,
    private readonly briefingGenerationService: BriefingGenerationService,
    private readonly configService: ConfigService,
  ) { }

  onModuleInit() {
    const { concurrency } = this.configService.getCustomBriefingQueueConfig();

    this.worker = createWorker(
      this.queue,
      (job: Job<CustomBriefingJobData>) => this.processCustomBriefing(job),
      { logger: this.logger, concurrency },
    );

    this.logger.log(
      `Custom briefing processor worker initialized with concurrency ${concurrency}`,
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
