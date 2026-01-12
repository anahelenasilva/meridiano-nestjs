import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { YoutubeChannel } from '../domain/youtube-channel';

export class CreateYoutubeChannelDto {
  @IsNotEmpty({ message: 'Channel ID is required' })
  @IsString({ message: 'Channel ID must be a string' })
  channelId: string;

  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsNotEmpty({ message: 'URL is required' })
  @IsUrl({}, { message: 'Invalid URL format' })
  url: string;

  @IsNotEmpty({ message: 'Description is required' })
  @IsString({ message: 'Description must be a string' })
  description: string;

  @IsBoolean({ message: 'Enabled must be a boolean' })
  enabled: boolean;

  @IsOptional()
  @IsInt({ message: 'Max videos must be an integer' })
  @Min(1, { message: 'Max videos must be at least 1' })
  maxVideos?: number;
}

export class YoutubeChannelResponseDto {
  id: string;
  channelId: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  maxVideos: number | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(channel: YoutubeChannel) {
    this.id = channel.id;
    this.channelId = channel.channelId;
    this.name = channel.name;
    this.url = channel.url;
    this.description = channel.description || '';
    this.enabled = channel.enabled;
    this.maxVideos = channel.maxVideos;
    this.createdAt = channel.createdAt;
    this.updatedAt = channel.updatedAt;
  }
}
