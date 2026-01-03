import { IsBoolean } from 'class-validator';

export class UpdateChannelEnabledDto {
  @IsBoolean()
  enabled: boolean;
}
