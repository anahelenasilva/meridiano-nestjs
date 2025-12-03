import { Module } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { ArticlesModule } from '../articles/articles.module';
import { BriefingsModule } from '../briefings/briefings.module';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    ArticlesModule,
    BriefingsModule,
    AiModule,
    ConfigModule,
    ProfilesModule,
  ],
  providers: [BriefingService],
  exports: [BriefingService],
})
export class BriefingModule {}
