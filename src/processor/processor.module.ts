import { AudioModule } from '@libs/audio';
import { EmailModule } from '@libs/email';
import { RedisModule } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { ArticleIngestionModule } from '../articles/ingestion/article-ingestion.module';
import { MarkdownArticleProcessor } from '../articles/processors/markdown-article.processor';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ArticleProcessingPipelineModule } from './pipeline/article-processing-pipeline.module';
import { ArticleProcessor } from './processors/article.processor';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    ArticlesModule,
    ArticleIngestionModule,
    ArticleProcessingPipelineModule,
    S3Module,
    AudioModule,
    AiModule,
    ConfigModule,
    ProfilesModule,
    EmailModule.forRoot(),
    RedisModule,
  ],
  providers: [ProcessorService, ArticleProcessor, MarkdownArticleProcessor],
  exports: [ProcessorService],
})
export class ProcessorModule {}
