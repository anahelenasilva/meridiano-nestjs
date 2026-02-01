import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { AudioFilesModule } from '../audio-files/audio-files.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    AiModule,
    ConfigModule,
    ProfilesModule,
    AudioFilesModule,
  ],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule { }
