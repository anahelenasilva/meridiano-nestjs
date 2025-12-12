import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ScraperModule } from '../scraper/scraper.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ScraperModule),
    forwardRef(() => QueueModule),
  ],
  providers: [ArticlesService, ListArticlesQuery, GetArticleByIdQuery],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule { }
