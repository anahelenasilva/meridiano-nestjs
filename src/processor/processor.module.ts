import { AudioModule } from '@libs/audio';
import { EmailModule } from '@libs/email';
import { QueueModule } from '@libs/queue';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { ArticleIngestionModule } from '../articles/ingestion/article-ingestion.module';
import { MarkdownArticleProcessor } from '../articles/processors/markdown-article.processor';
import { MarkdownUploadFailureNotifier } from '../articles/processors/markdown-upload-failure.notifier';
import { ConfigModule } from '../config/config.module';
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
    ConfigModule,
    QueueModule,
    EmailModule.forRoot(),
  ],
  providers: [
    ProcessorService,
    ArticleProcessor,
    MarkdownArticleProcessor,
    MarkdownUploadFailureNotifier,
  ],
  exports: [ProcessorService],
})
export class ProcessorModule {}
