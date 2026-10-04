import { resolveAuthConfigForRequest } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { hasActiveDevAuthSessionCookie, isDevAuthAvailable } from './dev-auth';
import type { PluginRouteScope } from './plugin-route-scope';

const logger = createSdkLogger({ component: 'plugin-route-scope', level: 'info' });

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
    const reason =
      error instanceof Error && error.name === 'TenantAuthResolutionError' && 'reason' in error
        ? error.reason
        : null;
    if (reason === 'tenant_host_invalid') return 'platform';
    if (reason === 'tenant_not_found') {
      logger.warn('Tenant plugin route scope unavailable', {
        operation: 'resolve_server_plugin_route_scope',
        reason_code: reason,
        tenant_host: error instanceof Error && 'host' in error ? error.host : undefined,
      });
      const publicMessage =
        error instanceof Error &&
        'publicMessage' in error &&
        typeof error.publicMessage === 'string'
          ? error.publicMessage
          : null;
      throw new Response(publicMessage, { status: 503 });
    }
    throw error;
  }
};
