import { AudioModule } from '@libs/audio';
import { EmailModule } from '@libs/email';
import { RedisModule } from '@libs/redis';
import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ArticleProcessor } from './processors/article.processor';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    AudioModule,
    AiModule,
    ConfigModule,
    ProfilesModule,
    EmailModule.forRoot(),
    RedisModule,
  ],
  providers: [ProcessorService, ArticleProcessor],
  exports: [ProcessorService],
})
export class ProcessorModule {}
