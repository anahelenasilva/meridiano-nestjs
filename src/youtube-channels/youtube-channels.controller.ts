import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateChannelEnabledCommand } from './commands/update-channel-enabled.command';
import { UpdateChannelEnabledDto } from './dto/update-channel-enabled.dto';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';

@Controller('api/youtube/channels')
export class YoutubeChannelsController {
  constructor(
    private readonly getYoutubeChannelsQuery: GetYoutubeChannelsQuery,
    private readonly updateChannelEnabledCommand: UpdateChannelEnabledCommand,
  ) { }

  @Get()
  async getChannels() {
    return await this.getYoutubeChannelsQuery.execute();
  }

  @Patch(':channelId')
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
