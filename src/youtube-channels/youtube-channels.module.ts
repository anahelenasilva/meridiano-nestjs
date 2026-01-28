import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { CreateYoutubeChannelCommand } from './commands/create-youtube-channel.command';
import { UpdateChannelEnabledCommand } from './commands/update-channel-enabled.command';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { YoutubeChannelsController } from './youtube-channels.controller';
import { YoutubeChannelsService } from './youtube-channels.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    YoutubeChannelsService,
    GetYoutubeChannelsQuery,
    UpdateChannelEnabledCommand,
    CreateYoutubeChannelCommand,
  ],
  controllers: [YoutubeChannelsController],
  exports: [
    YoutubeChannelsService,
    GetYoutubeChannelsQuery,
    UpdateChannelEnabledCommand,
    CreateYoutubeChannelCommand,
  ],
})
export class YoutubeChannelsModule { }
