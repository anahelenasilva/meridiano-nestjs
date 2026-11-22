import { RateLimitModule } from '@libs/rate-limit';
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackRateLimitGuard } from './feedback-rate-limit.guard';
import { FeedbackService } from './feedback.service';
import { GithubIssuesClient } from './github-issues.client';

@Module({
  imports: [RateLimitModule, UsersModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, GithubIssuesClient, FeedbackRateLimitGuard],
})
export class FeedbackModule {}
