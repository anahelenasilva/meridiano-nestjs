import { ApiKeyAllowed } from '@libs/auth';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { CreateYoutubeChannelCommand } from './commands/create-youtube-channel.command';
import { UpdateChannelEnabledCommand } from './commands/update-channel-enabled.command';
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
    });

    return new YoutubeChannelResponseDto(result.channel);
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
}
