import type { AuthenticatedUser } from '@libs/auth';

export type AuthenticatedRequest = {
  user: AuthenticatedUser;
};
