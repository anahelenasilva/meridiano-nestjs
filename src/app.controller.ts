import { Public } from '@libs/auth';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

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
