import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigService } from '../config/config.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ArticlesModule, EmailModule],
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
