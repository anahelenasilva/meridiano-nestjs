import { Injectable } from '@nestjs/common';
import { YoutubeChannelsService } from '../youtube-channels.service';

export interface YoutubeChannelResponse {
  id: string;
  channelId: string;
  url: string;
  name: string;
  description: string;
  enabled: boolean;
  maxVideos?: number | null;
}

@Injectable()
export class GetYoutubeChannelsQuery {
  constructor(private readonly youtubeChannelsService: YoutubeChannelsService) { }

  async execute(): Promise<YoutubeChannelResponse[]> {
    const channels = await this.youtubeChannelsService.getAllChannels();

    return channels.map((channel) => ({
      id: channel.id,
      channelId: channel.channelId,
      url: channel.url,
      name: channel.name,
      description: channel.description || '',
      enabled: channel.enabled,
      maxVideos: channel.maxVideos,
    }));
  }
}
