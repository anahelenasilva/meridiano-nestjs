import { Module, forwardRef } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperService } from './scraper.service';

@Module({
  imports: [forwardRef(() => ArticlesModule), ProfilesModule, ConfigModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule { }
