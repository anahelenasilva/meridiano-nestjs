import { AudioModule } from '@libs/audio';
import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { S3Module } from '@libs/s3';
import { Module, forwardRef } from '@nestjs/common';
import { AudioFilesModule } from '../audio-files/audio-files.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { MarkdownArticleProcessor } from './processors/markdown-article.processor';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Module({
  imports: [
    DatabaseModule,
    ProfilesModule,
    S3Module,
    RedisModule,
    AudioFilesModule,
    AudioModule,
    forwardRef(() => QueueModule),
    forwardRef(() => ProcessorModule),
    forwardRef(() => ScraperModule),
  ],
  providers: [
    ArticlesService,
    ListArticlesQuery,
    GetArticleByIdQuery,
    MarkdownArticleProcessor,
  ],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule {}
