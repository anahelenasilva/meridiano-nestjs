import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
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
  ],
  controllers: [YoutubeChannelsController],
  exports: [
    YoutubeChannelsService,
    GetYoutubeChannelsQuery,
    UpdateChannelEnabledCommand,
  ],
})
export class YoutubeChannelsModule { }
