import { Injectable, NotFoundException } from '@nestjs/common';
import { YoutubeChannelsService } from '../youtube-channels.service';

export interface UpdateChannelEnabledInput {
  channelId: string;
  enabled: boolean;
}

export interface UpdateChannelEnabledOutput {
  success: boolean;
  message: string;
}

@Injectable()
export class UpdateChannelEnabledCommand {
  constructor(private readonly youtubeChannelsService: YoutubeChannelsService) { }

  async execute(input: UpdateChannelEnabledInput): Promise<UpdateChannelEnabledOutput> {
    const { channelId, enabled } = input;

    try {
      const channel = await this.youtubeChannelsService.getChannelById(channelId);

      if (!channel) {
        throw new NotFoundException(`Channel with ID ${channelId} not found`);
      }

      await this.youtubeChannelsService.updateChannelEnabled(channelId, enabled);

      return {
        success: true,
        message: `Channel ${enabled ? 'enabled' : 'disabled'} successfully`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update channel: ${errorMessage}`);
    }
  }
}
