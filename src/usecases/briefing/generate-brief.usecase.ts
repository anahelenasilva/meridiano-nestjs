import { Injectable } from '@nestjs/common';
import { BriefingService } from '../../briefing/briefing.service';
import {
  GenerateBriefInputDto,
  GenerateBriefOutputDto,
} from './dto/generate-brief.dto';

@Injectable()
export class GenerateBriefUseCase {
  constructor(private readonly briefingService: BriefingService) { }

  async execute(
    input: GenerateBriefInputDto,
  ): Promise<GenerateBriefOutputDto> {
    const result = await this.briefingService.generateBrief(input.feedProfile);

    return {
      success: result.success,
      briefingId: result.briefingId,
      stats: result.stats,
      error: result.error,
    };
  }
}
