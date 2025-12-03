import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ArticlesModule } from '../articles/articles.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ArticlesModule, ProfilesModule, ConfigModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
