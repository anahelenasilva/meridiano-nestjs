import { AudioModule } from '@libs/audio';
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { RateLimitService } from '@libs/auth/rate-limit/rate-limit.service';
import { QueueModule } from '@libs/queue';
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
  ],
  providers: [ScraperService, RateLimitService, RateLimitGuard],
  controllers: [ArticlesController, ExternalArticlesController],
  exports: [ScraperService],
})
export class ScraperModule {}
