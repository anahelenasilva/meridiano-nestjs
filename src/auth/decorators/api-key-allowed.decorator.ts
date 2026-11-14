import { SetMetadata } from '@nestjs/common';

export const API_KEY_ALLOWED_KEY = 'apiKeyAllowed';

/**
 * Marks a route as reachable with a scoped static `x-api-key` credential
 * (env `MERIDIANO_API_KEY`) in addition to the default JWT auth.
 *
 * The key path is only consulted by {@link JwtAuthGuard} on decorated routes;
 * every other route stays JWT-only. A request without a valid key falls
 * through to the normal JWT check unchanged.
 */
export const ApiKeyAllowed = () => SetMetadata(API_KEY_ALLOWED_KEY, true);
