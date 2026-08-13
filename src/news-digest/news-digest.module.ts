import { RedisModule } from '@libs/redis';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigService } from '../config/config.service';
import { DigestArticleSelectorService } from './digest-article-selector.service';
import { DigestsService } from './digests.service';
import { DigestEntity } from './entities/digest.entity';
import { NewsDigestController } from './news-digest.controller';
import { NewsDigestService } from './news-digest.service';

@Module({
  imports: [
    ArticlesModule,
    RedisModule,
    TypeOrmModule.forFeature([DigestEntity]),
  ],
  controllers: [NewsDigestController],
  providers: [
    DigestArticleSelectorService,
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

    if (missing.length > 0) {
      this.logger.warn(
        `Daily Digest will not run — missing env vars: ${missing.join(', ')}`,
      );
    }
  }
}
