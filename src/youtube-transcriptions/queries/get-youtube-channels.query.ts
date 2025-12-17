import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

export interface YoutubeChannelResponse {
  id: string;
  url: string;
  name: string;
  description: string;
  enabled: boolean;
}

@Injectable()
export class GetYoutubeChannelsQuery {
  constructor(private readonly configService: ConfigService) { }

  async execute(): Promise<YoutubeChannelResponse[]> {
    const ytConfig = this.configService.getYoutubeChannelsConfig();

    return Object.entries(ytConfig.channels).map(([channelId, channelData]) => ({
      id: channelId,
      url: channelData.url,
      name: channelData.name,
      description: channelData.description,
      enabled: channelData.enabled !== false,
    }));
  }
}
