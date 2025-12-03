import { Controller, Get } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('api/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  getAvailableProfiles() {
    return this.profilesService.getAvailableProfiles();
  }
}
