import { Injectable } from '@nestjs/common';
import { CategoryResponseDto } from '../../categories/entities/category.entity';
import { ChannelCategoriesService } from '../channel-categories.service';
import { YoutubeChannelsService } from '../youtube-channels.service';

export interface YoutubeChannelResponse {
  id: string;
  channelId: string;
  url: string;
  name: string;
  description: string;
  enabled: boolean;
  maxVideos?: number | null;
  categories: CategoryResponseDto[];
}

@Injectable()
export class GetYoutubeChannelsQuery {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
    private readonly channelCategoriesService: ChannelCategoriesService,
  ) {}

  async execute(): Promise<YoutubeChannelResponse[]> {
    const channels = await this.youtubeChannelsService.getAllChannels();
    const categoriesByChannel =
      await this.channelCategoriesService.getCategoriesForChannels(
        channels.map((channel) => channel.id),
      );

    return channels.map((channel) => ({
      id: channel.id,
      channelId: channel.channelId,
      url: channel.url,
      name: channel.name,
      description: channel.description || '',
      enabled: channel.enabled,
      maxVideos: channel.maxVideos,
      categories: (categoriesByChannel.get(channel.id) ?? []).map(
        (category) => new CategoryResponseDto(category),
      ),
    }));
  }
}
