import { PLUGIN_ROUTE_SCOPE_HEADER_NAME } from '@sva/core';
import { withRequestContext } from '@sva/server-runtime';
import { getAuthConfig, resolveAuthConfigForRequest } from './config.js';
import { withAuthenticatedUser } from './middleware.js';
import { readCookieFromRequest } from './cookies.js';
import { buildLogContext } from './log-context.js';
import { createMockSessionUser } from './mock-auth.js';
import { TenantAuthResolutionError } from './runtime-errors.js';
import { logger, createAuthMeHeaders, createAuthDependencyErrorResponse } from './auth-route-responses.js';
import { attachSessionCookie } from './auth-route-cookies.js';
import { isActiveDevAuthRequest } from './auth-route-state.js';
import { resolveAuthMeState, createAuthMeResponse } from './auth-route-me-state.js';

export const meHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    let authConfig;
    try {
      authConfig = await resolveAuthConfigForRequest(request);
    } catch (error) {
      const response = createAuthDependencyErrorResponse(request, 'auth_me', error);
      response.headers.set(
        PLUGIN_ROUTE_SCOPE_HEADER_NAME,
        error instanceof TenantAuthResolutionError && error.reason === 'tenant_host_invalid'
          ? 'platform'
          : 'tenant'
      );
      return response;
    }
    const attachPluginRouteScope = (response: Response): Response => {
      response.headers.set(
        PLUGIN_ROUTE_SCOPE_HEADER_NAME,
        authConfig.kind === 'instance' ? 'tenant' : 'platform'
      );
      return response;
    };

    if (isActiveDevAuthRequest(request)) {
      return attachPluginRouteScope(
        new Response(JSON.stringify({ user: createMockSessionUser() }), {
          status: 200,
          headers: createAuthMeHeaders(),
        })
      );
    }

    logger.info('Auth me request received', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      cookie_header_present: Boolean(request.headers.get('cookie')),
      session_cookie_present: Boolean(
        readCookieFromRequest(request, getAuthConfig().sessionCookieName)
      ),
      ...buildLogContext(),
    });

    const response = await withAuthenticatedUser(
      request,
      async ({ user, sessionExpiresAt, sessionId }) => {
        const resolution = await resolveAuthMeState(user);

        logger.debug('Auth check successful', {
          endpoint: '/auth/me',
          auth_state: 'authenticated',
          operation: 'get_current_user',
          roles_count: user.roles?.length ?? 0,
          groups_count: resolution.groups.length,
          permission_actions_count: resolution.permissionActions.length,
          permission_status: resolution.permissionStatus,
          ...buildLogContext(
            user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : undefined
          ),
        });

        const response = createAuthMeResponse(user, resolution, sessionExpiresAt);
        attachSessionCookie(
          response,
          getAuthConfig().sessionCookieName,
          sessionId,
          sessionExpiresAt
        );
        return response;
      }
    );
    return attachPluginRouteScope(response);
  });
};
