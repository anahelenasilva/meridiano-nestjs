import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor() {}

  @Public()
  @Get('api/health')
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({ description: 'Service is healthy' })
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
