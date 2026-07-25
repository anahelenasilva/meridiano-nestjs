import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

@Module({
  imports: [ArticlesModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
