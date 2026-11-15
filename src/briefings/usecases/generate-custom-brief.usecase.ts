import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  GENERATE_CUSTOM_BRIEFING_JOB,
} from '@libs/queue';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { GenerateCustomBriefInputDto } from './dto/generate-custom-brief.dto';

export interface CustomBriefingJobData {
  articleIds: string[];
  feedProfile: FeedProfile;
  customPrompt?: string;
}

@Injectable()
export class GenerateCustomBriefUseCase {
  constructor(
    @Inject(CUSTOM_BRIEFING_GENERATION_QUEUE)
    private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: GenerateCustomBriefInputDto,
  ): Promise<{ jobId: string }> {
    const data: CustomBriefingJobData = {
      articleIds: input.articleIds,
      feedProfile: input.feedProfile,
      customPrompt: input.customPrompt,
    };
    const { attempts, backoffDelayMs } =
      this.configService.getCustomBriefingQueueConfig();
    const job = await this.queue.add(GENERATE_CUSTOM_BRIEFING_JOB, data, {
      attempts,
      backoff: { type: 'exponential', delay: backoffDelayMs },
    });

    return { jobId: job.id as string };
  }
}
