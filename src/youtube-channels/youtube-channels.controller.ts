import { ApiKeyAllowed } from '@libs/auth';
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { CategoryResponseDto } from '../categories/entities/category.entity';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { AssignChannelCategoriesCommand } from './commands/assign-channel-categories.command';
import { CreateYoutubeChannelCommand } from './commands/create-youtube-channel.command';
import { UpdateChannelEnabledCommand } from './commands/update-channel-enabled.command';
import { SetChannelCategoriesDto } from './dto/set-channel-categories.dto';
import { UpdateChannelEnabledDto } from './dto/update-channel-enabled.dto';
import {
  CreateYoutubeChannelDto,
  YoutubeChannelResponseDto,
} from './entities/youtube-channel.entity';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';

@Controller('api/youtube/channels')
@ApiAuthErrorResponse()
export class YoutubeChannelsController {
  constructor(
    private readonly getYoutubeChannelsQuery: GetYoutubeChannelsQuery,
    private readonly updateChannelEnabledCommand: UpdateChannelEnabledCommand,
    private readonly createYoutubeChannelCommand: CreateYoutubeChannelCommand,
    private readonly assignChannelCategoriesCommand: AssignChannelCategoriesCommand,
  ) {}

  @Get()
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'List YouTube channels' })
  @ApiOkResponse({ description: 'List of YouTube channels' })
  async getChannels() {
    return await this.getYoutubeChannelsQuery.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Register a new YouTube channel' })
  @ApiCreatedResponse({ type: YoutubeChannelResponseDto })
  @ApiValidationErrorResponse()
  async createChannel(@Body() dto: CreateYoutubeChannelDto) {
    const result = await this.createYoutubeChannelCommand.execute({
      channelId: dto.channelId,
      name: dto.name,
      url: dto.url,
      description: dto.description,
      enabled: dto.enabled,
      maxVideos: dto.maxVideos,
      categoryNames: dto.categoryNames,
    });

    return new YoutubeChannelResponseDto(result.channel, result.categories);
  }

  @Patch(':channelId')
  @ApiOperation({ summary: 'Enable or disable a YouTube channel' })
  @ApiOkResponse({ description: 'Channel enabled state updated' })
  @ApiValidationErrorResponse()
  async updateChannelEnabled(
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelEnabledDto,
  ) {
    return await this.updateChannelEnabledCommand.execute({
      channelId,
      enabled: dto.enabled,
    });
  }

  @Put(':channelId/categories')
  @ApiOperation({
    summary:
      "Replace a channel's category assignments with the submitted set",
  })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiValidationErrorResponse()
  async setChannelCategories(
    @Param('channelId') channelId: string,
    @Body() dto: SetChannelCategoriesDto,
  ) {
    const categories = await this.assignChannelCategoriesCommand.execute(
      channelId,
      dto.categoryNames,
    );

    return categories.map((category) => new CategoryResponseDto(category));
  }
}
