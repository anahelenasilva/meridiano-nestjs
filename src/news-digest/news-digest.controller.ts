import { ApiKeyAllowed } from '@libs/auth';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiAuthErrorResponse } from '../shared/swagger/api-error-response.decorators';
import { NewsDigestService } from './news-digest.service';

@Controller('api/news-digest')
@ApiAuthErrorResponse()
export class NewsDigestController {
  constructor(private readonly newsDigestService: NewsDigestService) {}

  @Get('latest')
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'Get the most recently persisted news digest' })
  @ApiOkResponse({ description: 'Latest digest items (empty array if no digest exists)' })
  async getLatest() {
    return this.newsDigestService.getLatestDigest();
  }
}
