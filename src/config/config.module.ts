import { Global, Module, forwardRef } from '@nestjs/common';
import { YoutubeChannelsModule } from '../youtube-channels/youtube-channels.module';
import { ConfigService } from './config.service';

@Global()
@Module({
  imports: [forwardRef(() => YoutubeChannelsModule)],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule { }
