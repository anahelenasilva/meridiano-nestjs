import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { BriefingService } from '../../briefing/briefing.service';
import {
  GenerateBriefInputDto,
  GenerateBriefOutputDto,
} from './dto/generate-brief.dto';

@Injectable()
export class GenerateBriefUseCase {
  constructor(
    private readonly briefingService: BriefingService,
    private readonly configService: ConfigService,
  ) { }

  async execute(
    input: GenerateBriefInputDto,
  ): Promise<GenerateBriefOutputDto> {
    if (!this.configService.isBriefingsGenerationEnabled()) {
      return {
        success: false,
        briefingId: undefined,
        stats: undefined,
        error: 'Briefings generation is disabled. Set ENABLE_BRIEFINGS_GENERATION=true to enable.',
      };
    }

    const result = await this.briefingService.generateBrief(input.feedProfile);

    return {
      success: result.success,
      briefingId: result.briefingId,
      stats: result.stats,
      error: result.error,
    };
  }
}
