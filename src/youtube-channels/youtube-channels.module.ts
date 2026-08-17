import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ChannelCategoriesService } from './channel-categories.service';
import { AssignChannelCategoriesCommand } from './commands/assign-channel-categories.command';
import { CreateYoutubeChannelCommand } from './commands/create-youtube-channel.command';
import { UpdateChannelEnabledCommand } from './commands/update-channel-enabled.command';
import { GetYoutubeChannelsQuery } from './queries/get-youtube-channels.query';
import { YoutubeChannelsController } from './youtube-channels.controller';
import { YoutubeChannelsService } from './youtube-channels.service';

@Module({
  imports: [DatabaseModule, CategoriesModule],
  providers: [
    YoutubeChannelsService,
    ChannelCategoriesService,
    GetYoutubeChannelsQuery,
    UpdateChannelEnabledCommand,
    CreateYoutubeChannelCommand,
    AssignChannelCategoriesCommand,
  ],
  controllers: [YoutubeChannelsController],
  exports: [
    YoutubeChannelsService,
    GetYoutubeChannelsQuery,
    UpdateChannelEnabledCommand,
    CreateYoutubeChannelCommand,
    AssignChannelCategoriesCommand,
  ],
})
export class YoutubeChannelsModule {}
