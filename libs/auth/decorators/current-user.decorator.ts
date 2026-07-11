import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
}

interface RequestWithUser {
  user: AuthenticatedUser;
}

/**
 * Injects the authenticated user resolved by the JWT strategy into a
 * controller handler, so handlers depend on validated auth state instead of
 * reading the raw request object.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
