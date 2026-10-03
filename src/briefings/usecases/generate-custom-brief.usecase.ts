import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CUSTOM_BRIEFING_GENERATION_QUEUE,
  GENERATE_CUSTOM_BRIEFING_JOB,
} from '@libs/queue/constants/queue.constants';
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
    if (!input.articleIds || input.articleIds.length < 2) {
      throw new BadRequestException('At least 2 articles must be selected');
    }
    if (input.articleIds.length > 10) {
      throw new BadRequestException('Maximum 10 articles can be selected');
    }
    if (!Object.values(FeedProfile).includes(input.feedProfile)) {
      throw new BadRequestException('Invalid feed profile');
    }

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
