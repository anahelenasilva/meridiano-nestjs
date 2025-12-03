import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
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
    // const briefings =
    //   await this.briefingsService.getAllBriefsMetadata(feedProfile);
    // return briefings;

    return this.listBriefingsQuery.execute(feedProfile);
  }

  @Get(':id')
  async getBriefing(@Param('id', ParseIntPipe) id: number) {
    const briefing = await this.briefingsService.getBriefById(id);
    if (!briefing) {
      return { error: 'Briefing not found' };
    }
    return briefing;
  }
}
