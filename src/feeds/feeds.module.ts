import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { YoutubeTranscriptionsModule } from '../youtube-transcriptions/youtube-transcriptions.module';
import { FeedsController } from './feeds.controller';
import { GetArticlesFeedQuery } from './queries/get-articles-feed.query';
import { GetYoutubeFeedQuery } from './queries/get-youtube-feed.query';

@Module({
  imports: [ArticlesModule, YoutubeTranscriptionsModule],
  controllers: [FeedsController],
  providers: [GetArticlesFeedQuery, GetYoutubeFeedQuery],
})
export class FeedsModule {}
