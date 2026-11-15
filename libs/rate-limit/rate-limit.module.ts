import { RedisModule } from '@libs/redis';
import { Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

// Import this in any module whose controllers use @UseGuards(RateLimitGuard)
// or a subclass of it, so the guard can resolve RateLimitService.
@Module({
  imports: [RedisModule],
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
