import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  AuthService,
  LoginDto,
  LoginResponseDto,
  Public,
  RateLimit,
  RateLimitGuard,
} from '@libs/auth';
import { ApiValidationErrorResponse } from '../shared/swagger/api-error-response.decorators';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 15 * 60 * 1000, maxAttempts: 5 })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user and obtain a JWT access token' })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @ApiValidationErrorResponse()
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
