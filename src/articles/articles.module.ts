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
import { GenerateArticleAudioCommand } from './commands/generate-article-audio.command';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ExternalArticlesController } from './external-articles.controller';
import { MarkdownArticleProcessor } from './processors/markdown-article.processor';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';
import { TelegramSubmissionService } from './services/telegram-submission.service';
import { RateLimitService } from '@libs/auth/rate-limit/rate-limit.service';
import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';

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
    GenerateArticleAudioCommand,
    ListArticlesQuery,
    GetArticleByIdQuery,
    MarkdownArticleProcessor,
    TelegramSubmissionService,
    RateLimitService,
    RateLimitGuard,
  ],
  controllers: [ArticlesController, ExternalArticlesController],
  exports: [ArticlesService, TelegramSubmissionService],
})
export class ArticlesModule {}
