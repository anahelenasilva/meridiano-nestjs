import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOrCreateCategoriesCommand } from '../../categories/commands/find-or-create-categories.command';
import { Category } from '../../categories/domain/category';
import { ChannelCategoriesService } from '../channel-categories.service';
import { YoutubeChannelsService } from '../youtube-channels.service';

@Injectable()
export class AssignChannelCategoriesCommand {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly findOrCreateCategoriesCommand: FindOrCreateCategoriesCommand,
    private readonly channelCategoriesService: ChannelCategoriesService,
  ) {}

  async execute(
    channelId: string,
    categoryNames: string[],
  ): Promise<Category[]> {
    const channel = await this.youtubeChannelsService.getChannelById(
      channelId,
    );
    if (!channel) {
      throw new NotFoundException(`Channel with ID ${channelId} not found`);
    }

    const categories =
      await this.findOrCreateCategoriesCommand.execute(categoryNames);

    await this.channelCategoriesService.replaceChannelCategories(
      channelId,
      categories.map((category) => category.id),
    );

    // Re-read rather than return `categories` directly: guarantees the
    // response reflects the actual persisted set (consistently sorted by
    // name) rather than the in-memory list computed before the write.
    return this.channelCategoriesService.getCategoriesForChannel(channelId);
  }
}
