import { Injectable } from '@nestjs/common';
import { YoutubeChannel } from '../domain/youtube-channel';
import { YoutubeChannelsService } from '../youtube-channels.service';

export interface CreateYoutubeChannelInput {
  channelId: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  maxVideos?: number;
}

export interface CreateYoutubeChannelOutput {
  success: boolean;
  message: string;
  channel: YoutubeChannel;
}

@Injectable()
export class CreateYoutubeChannelCommand {
  constructor(
    private readonly youtubeChannelsService: YoutubeChannelsService,
  ) {}

  async execute(
    input: CreateYoutubeChannelInput,
  ): Promise<CreateYoutubeChannelOutput> {
    const { channelId, name, url, description, enabled, maxVideos } = input;

    try {
      const channel = await this.youtubeChannelsService.createChannel(
        channelId,
        name,
        url,
        description,
        enabled,
        maxVideos,
      );

      return {
        success: true,
        message: 'Channel created successfully',
        channel,
      };
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }
}
