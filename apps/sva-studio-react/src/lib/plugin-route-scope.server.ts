import { resolveAuthConfigForRequest } from '@sva/auth-runtime/server';

import { hasActiveDevAuthSessionCookie, isDevAuthAvailable } from './dev-auth';
import type { PluginRouteScope } from './plugin-route-scope';

const isInvalidTenantHostError = (error: unknown): boolean =>
  error instanceof Error &&
  error.name === 'TenantAuthResolutionError' &&
  'reason' in error &&
  error.reason === 'tenant_host_invalid';

export const resolveServerPluginRouteScope = async (
  request: Request
): Promise<PluginRouteScope> => {
  if (isDevAuthAvailable() && hasActiveDevAuthSessionCookie(request.headers.get('cookie'))) {
    return 'tenant';
  }

  try {
    const authConfig = await resolveAuthConfigForRequest(request);
    return authConfig.kind === 'instance' ? 'tenant' : 'platform';
  } catch (error) {
    if (isInvalidTenantHostError(error)) return 'platform';
    throw error;
  }
};
