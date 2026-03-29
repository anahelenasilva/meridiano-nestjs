import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import {
  GenerateBriefInputDto,
  GenerateBriefOutputDto,
} from './dto/generate-brief.dto';

@Injectable()
export class GenerateSimpleBriefUseCase {
  constructor(
    private readonly briefingGenerationService: BriefingGenerationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: GenerateBriefInputDto): Promise<GenerateBriefOutputDto> {
    if (!this.configService.isBriefingsGenerationEnabled()) {
      return {
        success: false,
        briefingId: undefined,
        error:
          'Briefings generation is disabled. Set ENABLE_BRIEFINGS_GENERATION=true to enable.',
      };
    }

    const result = await this.briefingGenerationService.generateSimpleBrief(
      input.feedProfile,
    );

    return {
      success: result.success,
      briefingId: result.briefingId,
      error: result.error,
    };
  }
}
