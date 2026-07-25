import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape pinned to Nest's default ValidationPipe exception (class-validator
 * `whitelist`/`forbidNonWhitelisted`/`transform` options, no custom exception
 * filter). If those options or a filter change later, this DTO goes stale
 * silently — see ADR-0006.
 */
export class ValidationErrorResponseDto {
  @ApiProperty({ type: Number, example: 400 })
  statusCode: 400;

  @ApiProperty({ type: [String], example: ['source_id must be a valid UUID'] })
  message: string[];

  @ApiProperty({ type: String, example: 'Bad Request' })
  error: string;
}

/**
 * Shape pinned to Passport's default AuthGuard unauthorized response (no
 * custom exception filter). If a custom filter is introduced later, this DTO
 * goes stale silently — see ADR-0006.
 */
export class UnauthorizedResponseDto {
  @ApiProperty({ type: Number, example: 401 })
  statusCode: 401;

  @ApiProperty({ type: String, example: 'Unauthorized' })
  message: string;
}
