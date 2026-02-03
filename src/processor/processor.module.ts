import { QueueModule } from '@libs/queue';
import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    forwardRef(() => QueueModule),
    AiModule,
    ConfigModule,
    ProfilesModule,
  ],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule { }
