import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { ChannelConfig } from '../../../shared/types/channel';

export class ExtractYoutubeTranscriptsInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  @IsNotEmpty()
  channels: ChannelConfig[];
}

export interface ExtractYoutubeTranscriptsOutputDto {
  success: boolean;
  channelsProcessed: number;
  message?: string;
}
