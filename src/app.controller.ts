import { Public } from '@libs/auth';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() { }

  @Public()
  @Get('api/health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
