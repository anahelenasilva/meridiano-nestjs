import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, LoginDto, LoginResponseDto, Public } from '@libs/auth';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
