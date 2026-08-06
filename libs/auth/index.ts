export { AuthModule } from './auth.module';
export { AuthService, USER_LOOKUP_PROVIDER_TOKEN } from './auth.service';
export { CurrentUser } from './decorators/current-user.decorator';
export type { AuthenticatedUser } from './decorators/current-user.decorator';
export {
  API_KEY_ALLOWED_KEY,
  ApiKeyAllowed,
} from './decorators/api-key-allowed.decorator';
export { IS_PUBLIC_KEY, Public } from './decorators/public.decorator';
export { LoginResponseDto } from './dto/login-response.dto';
export { LoginDto } from './dto/login.dto';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { JwtStrategy } from './strategies/jwt.strategy';
export { RateLimitGuard, RateLimitService } from './rate-limit';
export { RateLimit } from './rate-limit/rate-limit.decorator';
export type { RateLimitOptions } from './rate-limit/rate-limit.types';
