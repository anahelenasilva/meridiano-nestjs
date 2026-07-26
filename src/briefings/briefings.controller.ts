import { JwtAuthGuard } from '@libs/auth';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { QueueService } from '../../libs/queue/queue.service';
import type { FeedProfile } from '../shared/types/feed';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { GenerateBriefInputDto } from './usecases/dto/generate-brief.dto';
import type { GenerateCustomBriefInputDto } from './usecases/dto/generate-custom-brief.dto';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateCustomBriefUseCase } from './usecases/generate-custom-brief.usecase';

@Controller('api/briefings')
@ApiAuthErrorResponse()
export class BriefingsController {
  constructor(
    private readonly briefingsService: BriefingsService,
    private readonly listBriefingsQuery: ListBriefingsQuery,
    private readonly generateBriefUseCase: GenerateBriefUseCase,
    private readonly generateCustomBriefUseCase: GenerateCustomBriefUseCase,
    private readonly queueService: QueueService,
  ) {}

  private static readonly MAX_LIMIT = 100;

  @Get()
  @ApiOperation({ summary: 'List briefings, optionally filtered by feed profile' })
  @ApiOkResponse({ description: 'List of briefings' })
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
  @ApiOperation({ summary: 'Get a briefing by id' })
  @ApiOkResponse({ description: 'Briefing retrieved' })
  @ApiNotFoundResponse({ description: 'Briefing not found' })
  async getBriefing(@Param('id', ParseUUIDPipe) id: string) {
    const briefing = await this.briefingsService.getBriefById(id);
    if (!briefing) {
      throw new NotFoundException('Briefing not found');
    }
    return briefing;
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a briefing for a feed profile' })
  @ApiCreatedResponse({ description: 'Generated briefing' })
  @ApiValidationErrorResponse()
  async generateBriefing(@Body() input: GenerateBriefInputDto) {
    return this.generateBriefUseCase.execute(input);
  }

  @Post('custom')
  @ApiOperation({ summary: 'Generate a custom briefing from a specific set of articles' })
  @ApiCreatedResponse({ description: 'Generated custom briefing' })
  async generateCustomBriefing(@Body() input: GenerateCustomBriefInputDto) {
    return this.generateCustomBriefUseCase.execute(input);
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get the status of a custom briefing generation job' })
  @ApiOkResponse({ description: 'Job status retrieved' })
  async getCustomBriefingJobStatus(@Param('jobId') jobId: string) {
    return this.queueService.getCustomBriefingJobStatus(jobId);
  }

  @Patch(':id/title')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update the custom title of a briefing' })
  @ApiOkResponse({ description: 'Brief title updated' })
  async updateBriefTitle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { customTitle: string },
  ) {
    await this.briefingsService.updateBriefTitle(id, body.customTitle);
    return { success: true };
  }
}
