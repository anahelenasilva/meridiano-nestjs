import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import {
  GenerateBriefInputDto,
  GenerateBriefOutputDto,
} from './dto/generate-brief.dto';

@Injectable()
export class GenerateBriefUseCase {
  constructor(
    private readonly briefingGenerationService: BriefingGenerationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: GenerateBriefInputDto): Promise<GenerateBriefOutputDto> {
    if (!this.configService.isBriefingsGenerationEnabled()) {
      return {
        success: false,
        briefingId: undefined,
        stats: undefined,
        error:
          'Briefings generation is disabled. Set ENABLE_BRIEFINGS_GENERATION=true to enable.',
      };
    }

    const result = await this.briefingGenerationService.generateBrief(input.feedProfile, {
      customPrompts: input.customPrompts,
    });

    return {
      success: result.success,
      briefingId: result.briefingId,
      stats: result.stats,
      error: result.error,
    };
  }
}
