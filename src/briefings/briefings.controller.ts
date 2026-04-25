import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { FeedProfile } from '../shared/types/feed';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { GenerateBriefInputDto } from './usecases/dto/generate-brief.dto';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';

@Controller('api/briefings')
export class BriefingsController {
  constructor(
    private readonly briefingsService: BriefingsService,
    private readonly listBriefingsQuery: ListBriefingsQuery,
    private readonly generateBriefUseCase: GenerateBriefUseCase,
  ) {}

  private static readonly MAX_LIMIT = 100;

  @Get()
  async listBriefings(
    @Query('feedProfile') feedProfile?: FeedProfile,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit !== undefined ? parseInt(limit, 10) : undefined;
    const parsedLimit =
      parsed !== undefined && !isNaN(parsed)
        ? Math.min(parsed, BriefingsController.MAX_LIMIT)
        : undefined;
    return this.listBriefingsQuery.execute(feedProfile, parsedLimit);
  }

  @Get(':id')
  async getBriefing(@Param('id', ParseUUIDPipe) id: string) {
    const briefing = await this.briefingsService.getBriefById(id);
    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }
    return briefing;
  }

  @Post('generate')
  async generateBriefing(@Body() input: GenerateBriefInputDto) {
    return this.generateBriefUseCase.execute(input);
  }
}
