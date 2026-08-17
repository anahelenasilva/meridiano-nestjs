import { Injectable } from '@nestjs/common';
import { Category } from '../../categories/domain/category';
import { YoutubeChannel } from '../domain/youtube-channel';
import { YoutubeChannelsService } from '../youtube-channels.service';
import { AssignChannelCategoriesCommand } from './assign-channel-categories.command';

export interface CreateYoutubeChannelInput {
  channelId: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  maxVideos?: number;
  categoryNames?: string[];
}

export interface CreateYoutubeChannelOutput {
  success: boolean;
  message: string;
  channel: YoutubeChannel;
  categories: Category[];
}

@Injectable()
export class CreateYoutubeChannelCommand {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly assignChannelCategoriesCommand: AssignChannelCategoriesCommand,
  ) {}

  async execute(
    input: CreateYoutubeChannelInput,
  ): Promise<CreateYoutubeChannelOutput> {
    const {
      channelId,
      name,
      url,
      description,
      enabled,
      maxVideos,
      categoryNames,
    } = input;

    const channel = await this.createChannel(
      channelId,
      name,
      url,
      description,
      enabled,
      maxVideos,
    );

    const categories = categoryNames?.length
      ? await this.assignCategories(channel, categoryNames)
      : [];

    return {
      success: true,
      message: 'Channel created successfully',
      channel,
      categories,
    };
  }

  private async createChannel(
    channelId: string,
    name: string,
    url: string,
    description: string,
    enabled: boolean,
    maxVideos: number | undefined,
  ): Promise<YoutubeChannel> {
    try {
      return await this.youtubeChannelsService.createChannel(
        channelId,
        name,
        url,
        description,
        enabled,
        maxVideos,
      );
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }

  private async assignCategories(
    channel: YoutubeChannel,
    categoryNames: string[],
  ): Promise<Category[]> {
    try {
      return await this.assignChannelCategoriesCommand.execute(
        channel.id,
        categoryNames,
      );
    } catch (error) {
      // The channel row is already committed at this point — it now exists
      // uncategorized rather than not existing at all, so this needs its own
      // log line naming the channel for an operator to find and retry.
      console.error(
        `Channel ${channel.id} was created but category assignment failed:`,
        error,
      );
      throw error;
    }
  }
}
