import { Module } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { ArticlesModule } from '../articles/articles.module';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ArticlesModule, AiModule, ConfigModule, ProfilesModule],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule {}
