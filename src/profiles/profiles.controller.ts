import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiAuthErrorResponse } from '../shared/swagger/api-error-response.decorators';
import { ProfilesService } from './profiles.service';

@Controller('api/profiles')
@ApiAuthErrorResponse()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'List the available feed profiles' })
  @ApiOkResponse({ description: 'Available feed profiles' })
  getAvailableProfiles() {
    return this.profilesService.getAvailableProfiles();
  }
}
