import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { QueueModule } from '../queue/queue.module';
import { S3Module } from '../s3/s3.module';
import { ScraperModule } from '../scraper/scraper.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Module({
  imports: [
    DatabaseModule,
    ProfilesModule,
    S3Module,
    forwardRef(() => ScraperModule),
    forwardRef(() => QueueModule),
  ],
  providers: [ArticlesService, ListArticlesQuery, GetArticleByIdQuery],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule { }
