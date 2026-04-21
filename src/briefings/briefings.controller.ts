import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import type { FeedProfile } from '../shared/types/feed';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

@Controller('api/briefings')
export class BriefingsController {
  constructor(
    private readonly briefingsService: BriefingsService,
    private readonly listBriefingsQuery: ListBriefingsQuery,
  ) {}

  @Get()
  async listBriefings(@Query('feedProfile') feedProfile?: FeedProfile) {
    return this.listBriefingsQuery.execute(feedProfile);
  }

  @Get(':id')
  async getBriefing(@Param('id', ParseUUIDPipe) id: string) {
    const briefing = await this.briefingsService.getBriefById(id);
    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }
    return briefing;
  }
}
