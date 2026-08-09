import { EmailModule } from '@libs/email';
import { RedisModule } from '@libs/redis';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigService } from '../config/config.service';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestEmailComposerService } from './digest-email-composer.service';
import { DigestsService } from './digests.service';
import { DigestEntity } from './entities/digest.entity';
import { NewsDigestService } from './news-digest.service';

@Module({
  imports: [
    ArticlesModule,
    EmailModule.forRoot(),
    RedisModule,
    TypeOrmModule.forFeature([DigestEntity]),
  ],
  providers: [
    DigestArticleSelectorService,
    DigestEmailComposerService,
    DigestsService,
    NewsDigestService,
  ],
})
export class NewsDigestModule implements OnModuleInit {
  private readonly logger = new Logger(NewsDigestModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const missing: string[] = [];

    if (!this.configService.getNewsDigestPrompt()) {
      missing.push('NEWS_DIGEST_PROMPT');
    }
    if (!this.configService.getNewsDigestToEmail()) {
      missing.push('NEWS_DIGEST_TO_EMAIL');
    }
    if (!this.configService.getNewsDigestFromEmail()) {
      missing.push('NEWS_DIGEST_FROM_EMAIL');
    }

    if (missing.length > 0) {
      this.logger.warn(
        `Daily Digest will not run — missing env vars: ${missing.join(', ')}`,
      );
    }
  }
}
