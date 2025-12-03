import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Module({
  imports: [DatabaseModule],
  providers: [ArticlesService, ListArticlesQuery, GetArticleByIdQuery],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule {}
