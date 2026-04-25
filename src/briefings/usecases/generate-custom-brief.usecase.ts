import { BadRequestException, Injectable } from '@nestjs/common';
import { QueueService } from '../../../libs/queue/queue.service';
import { FeedProfile } from '../../shared/types/feed';
import { GenerateCustomBriefInputDto } from './dto/generate-custom-brief.dto';

@Injectable()
export class GenerateCustomBriefUseCase {
  constructor(private readonly queueService: QueueService) {}

  async execute(input: GenerateCustomBriefInputDto): Promise<{ jobId: string }> {
    if (!input.articleIds || input.articleIds.length < 2) {
      throw new BadRequestException('At least 2 articles must be selected');
    }
    if (input.articleIds.length > 10) {
      throw new BadRequestException('Maximum 10 articles can be selected');
    }
    if (!Object.values(FeedProfile).includes(input.feedProfile)) {
      throw new BadRequestException('Invalid feed profile');
    }

    const { jobId } = await this.queueService.addCustomBriefingJob({
      articleIds: input.articleIds,
      feedProfile: input.feedProfile,
      customPrompt: input.customPrompt,
    });

    return { jobId };
  }
}
