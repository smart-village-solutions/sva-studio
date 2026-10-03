import { getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';
import { emitAuthAuditEvent } from './audit-events.js';
import { resolveAuthConfigForRequest } from './config.js';
import { logoutSession } from './auth-server/logout.js';
import { getSession } from './redis-session.js';
import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';
import { buildLogContext } from './log-context.js';
import { getScopeFromAuthConfig, getWorkspaceIdForScope } from './scope.js';
import { DEV_AUTH_COOKIE_NAME, isMockAuthEnabled } from './mock-auth.js';
import { SessionStoreUnavailableError } from './runtime-errors.js';
import { logger, createRedirectResponse, createNotFoundResponse, createAuthDependencyErrorResponse, summarizeRedirectTarget } from './auth-route-responses.js';
import { getSetCookieValues, attachSilentSsoSuppressCookie, attachDeletedCookie } from './auth-route-cookies.js';
import { hasExplicitLogoutIntent, sanitizeReturnTo, isActiveDevAuthRequest } from './auth-route-state.js';

const resolveLogoutUrl = async ({
  request,
  authConfig,
  authScope,
}: {
  readonly request: Request;
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: ReturnType<typeof getScopeFromAuthConfig>;
}): Promise<string> => {
  const { sessionCookieName, postLogoutRedirectUri } = authConfig;
  const sessionId = readCookieFromRequest(request, sessionCookieName);
  if (!sessionId) {
    logger.debug('Logout without session', {
      endpoint: '/auth/logout',
      operation: 'logout',
      session_exists: false,
      ...buildLogContext(authScope),
    });
    return postLogoutRedirectUri;
  }

  try {
    const sessionBeforeLogout = await getSession(sessionId);
    const logoutUrl = await logoutSession(sessionId, authConfig);

    logger.info('Logout successful', {
      endpoint: '/auth/logout',
      operation: 'logout',
      ...summarizeRedirectTarget(logoutUrl),
      ...buildLogContext(
        sessionBeforeLogout?.user?.instanceId
          ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId }
          : authScope
      ),
      workspaceId: sessionBeforeLogout?.user?.instanceId ?? getWorkspaceIdForScope(authScope),
      outcome: 'success',
    });

    await emitAuthAuditEvent({
      eventType: 'logout',
      actorUserId: sessionBeforeLogout?.user?.id ?? sessionBeforeLogout?.userId,
      scope: sessionBeforeLogout?.user?.instanceId
        ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId }
        : authScope,
      workspaceId: sessionBeforeLogout?.user?.instanceId ?? getWorkspaceIdForScope(authScope),
      outcome: 'success',
    });

    return logoutUrl;
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      throw error;
    }
    logger.error('Logout failed', {
      endpoint: '/auth/logout',
      operation: 'logout',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      reason_code: 'logout_failed',
      ...buildLogContext(authScope),
    });
    return postLogoutRedirectUri;
  }
};

const createLogoutResponse = ({
  logoutUrl,
  sessionCookieName,
  silentSsoSuppressCookieName,
  silentSsoSuppressAfterLogoutMs,
  authScope,
}: {
  readonly logoutUrl: string;
  readonly sessionCookieName: string;
  readonly silentSsoSuppressCookieName: string;
  readonly silentSsoSuppressAfterLogoutMs: number;
  readonly authScope: ReturnType<typeof getScopeFromAuthConfig>;
}) => {
  const response = createRedirectResponse(logoutUrl);
  const sessionDeleteStrategy = attachDeletedCookie(response, sessionCookieName);
  const silentSsoSuppressStrategy = attachSilentSsoSuppressCookie(
    response,
    silentSsoSuppressCookieName,
    Date.now() + silentSsoSuppressAfterLogoutMs
  );
  logger.info('Logout cookies prepared', {
    endpoint: '/auth/logout',
    operation: 'logout_cookie_cleanup',
    session_delete_strategy: sessionDeleteStrategy,
    silent_sso_suppress_strategy: silentSsoSuppressStrategy,
    response_set_cookie_count: getSetCookieValues(response.headers).length,
    ...buildLogContext(authScope),
  });
  return response;
};

export const devLogoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (!isMockAuthEnabled()) {
      return createNotFoundResponse();
    }

    const url = new URL(request.url);
    const returnTo = await sanitizeReturnTo(request, url.searchParams.get('returnTo'));
    const response = createRedirectResponse(returnTo);
    appendSetCookie(response, deleteCookieHeader(DEV_AUTH_COOKIE_NAME));
    return response;
  });
};

export const logoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isActiveDevAuthRequest(request)) {
      const response = createRedirectResponse('/');
      appendSetCookie(response, deleteCookieHeader(DEV_AUTH_COOKIE_NAME));
      return response;
    }

    try {
      if (!(await hasExplicitLogoutIntent(request))) {
        logger.warn('Logout rejected without explicit user intent', {
          endpoint: '/auth/logout',
          operation: 'logout',
          reason_code: 'missing_logout_intent',
          ...buildLogContext(undefined),
        });

        return toJsonErrorResponse(
          400,
          'logout_intent_required',
          'Logout requires explicit user intent.',
          {
            requestId: getWorkspaceContext().requestId,
          }
        );
      }

      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const {
        sessionCookieName,
        postLogoutRedirectUri,
        silentSsoSuppressCookieName,
        silentSsoSuppressAfterLogoutMs,
      } = authConfig;
      const logoutUrl = await resolveLogoutUrl({ request, authConfig, authScope });
      return createLogoutResponse({
        logoutUrl: logoutUrl || postLogoutRedirectUri,
        sessionCookieName,
        silentSsoSuppressCookieName,
        silentSsoSuppressAfterLogoutMs,
        authScope,
      });
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_logout', error);
    }
  });
};
