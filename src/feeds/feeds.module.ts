import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { FeedsController } from './feeds.controller';
import { GetArticlesFeedQuery } from './queries/get-articles-feed.query';

@Module({
  imports: [ArticlesModule],
  controllers: [FeedsController],
  providers: [GetArticlesFeedQuery],
})
export class FeedsModule {}
