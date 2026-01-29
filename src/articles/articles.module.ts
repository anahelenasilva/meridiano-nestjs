import { DatabaseModule } from '@libs/database';
import { QueueModule, RedisService } from '@libs/queue';
import { S3Module } from '@libs/s3';
import { Module, forwardRef } from '@nestjs/common';
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
    forwardRef(() => QueueModule),
    forwardRef(() => ProcessorModule),
    forwardRef(() => ScraperModule),
  ],
  providers: [
    RedisService,
    ArticlesService,
    ListArticlesQuery,
    GetArticleByIdQuery,
    MarkdownArticleProcessor,
  ],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule { }
