import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../../libs/auth/auth.service';
import { Public } from '../../libs/auth/decorators/public.decorator';
import { LoginResponseDto } from '../../libs/auth/dto/login-response.dto';
import { LoginDto } from '../../libs/auth/dto/login.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
