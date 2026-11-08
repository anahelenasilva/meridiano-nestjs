import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { ArticleActionsController } from './article-actions.controller';
import { ArticleActionsService } from './article-actions.service';

@Module({
  imports: [DatabaseModule],
  providers: [ArticleActionsService],
  controllers: [ArticleActionsController],
})
export class ArticleActionsModule {}
