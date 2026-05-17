import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles.module';
import { ArticleIngestionService } from './article-ingestion.service';

@Module({
  imports: [ArticlesModule],
  providers: [ArticleIngestionService],
  exports: [ArticleIngestionService],
})
export class ArticleIngestionModule {}
