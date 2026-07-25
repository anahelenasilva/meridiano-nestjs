import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import {
  UnauthorizedResponseDto,
  ValidationErrorResponseDto,
} from './api-error-response.dto';

export function ApiValidationErrorResponse() {
  return applyDecorators(
    ApiBadRequestResponse({
      type: ValidationErrorResponseDto,
      description: 'Request failed class-validator validation',
    }),
  );
}

export function ApiAuthErrorResponse() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      type: UnauthorizedResponseDto,
      description: 'Missing or invalid bearer token',
    }),
  );
}
