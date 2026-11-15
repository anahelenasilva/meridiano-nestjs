import { AudioModule } from '@libs/audio';
import { QueueModule } from '@libs/queue';
import { RateLimitModule } from '@libs/rate-limit';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { ArticlesController } from '../articles/articles.controller';
import { ExternalArticlesController } from '../articles/external-articles.controller';
import { ArticleIngestionModule } from '../articles/ingestion/article-ingestion.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperService } from './scraper.service';

@Module({
  imports: [
    ArticleIngestionModule,
    ArticlesModule,
    ProfilesModule,
    ConfigModule,
    QueueModule,
    AudioModule,
    S3Module,
    RateLimitModule,
  ],
  providers: [ScraperService],
  controllers: [ArticlesController, ExternalArticlesController],
  exports: [ScraperService],
})
export class ScraperModule {}
