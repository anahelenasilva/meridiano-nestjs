import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginResponseDto } from '../../src/auth/dto/login-response.dto';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userLookupProvider: UserLookupProvider,
    private readonly jwtService: JwtService,
  ) { }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userLookupProvider.getUserByEmail(email, true);

    if (!user) {
      throw new UnauthorizedException('Failed to login');
    }

    if (!user.password) {
      throw new UnauthorizedException('Failed to login');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Failed to login');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return new LoginResponseDto(accessToken, {
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  async validateUser(userId: string) {
    return this.userLookupProvider.getUserById(userId);
  }
}
