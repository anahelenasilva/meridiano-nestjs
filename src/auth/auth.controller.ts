import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  AuthService,
  LoginDto,
  LoginResponseDto,
  Public,
  RateLimit,
  RateLimitGuard,
} from '@libs/auth';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 15 * 60 * 1000, maxAttempts: 5 })
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
