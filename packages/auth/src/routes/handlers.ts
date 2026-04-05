import { serialize as serializeCookie } from 'cookie-es';
import { classifyHost, isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data/server';
import {
  createSdkLogger,
  getInstanceConfig,
  initializeOtelSdk,
  isCanonicalAuthHost,
  toJsonErrorResponse,
  withRequestContext,
} from '@sva/sdk/server';

import { createLoginUrl, handleCallback, logoutSession } from '../auth.server.js';
import { emitAuthAuditEvent } from '../audit-events.server.js';
import { getAuthConfig, resolveAuthConfigForRequest } from '../config.js';
import { createMockSessionUser, isMockAuthEnabled } from '../mock-auth.server.js';
import { getSession } from '../redis-session.server.js';
import { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from '../request-hosts.js';
import { SessionStoreUnavailableError, TenantAuthResolutionError } from '../runtime-errors.js';
import { DEFAULT_WORKSPACE_ID, PLATFORM_WORKSPACE_ID, getScopeFromAuthConfig, getWorkspaceIdForScope } from '../scope.js';
import { isTokenErrorLike } from '../shared/error-guards.js';
import { buildLogContext } from '../shared/log-context.js';
import { withAuthenticatedUser } from '../middleware.server.js';
import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';
import { decodeLoginStateCookie, encodeLoginStateCookie, type LoginStateCookiePayload } from './login-state-cookie.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldAttachDebugAuthHeaders = (): boolean => process.env.SVA_AUTH_DEBUG_HEADERS === 'true';

initializeOtelSdk().catch((error: unknown) => {
  logger.error('Fehler bei OTEL SDK Initialisierung im Auth-Modul', {
    component: 'iam-auth',
    dependency: 'otel',
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'otel_init_failed',
    ...buildLogContext(DEFAULT_WORKSPACE_ID),
  });
});

const createRedirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location },
  });

const createAuthDependencyErrorResponse = (
  request: Request,
  operation: 'auth_callback' | 'auth_login' | 'auth_logout',
  error: unknown
): Response => {
  const requestId = request.headers.get('x-request-id') ?? undefined;

  if (error instanceof TenantAuthResolutionError) {
    logger.error('Auth route failed during tenant auth resolution', {
      endpoint: request.url,
      operation,
      error_type: error.name,
      reason_code: 'scope_resolution_failed',
      reason: error.reason,
      tenant_host: error.host,
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(503, 'internal_error', error.publicMessage, { requestId });
  }

  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth route failed because session storage is unavailable', {
      endpoint: request.url,
      operation,
      error_type: error.name,
      reason_code: 'session_store_unavailable',
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(
      503,
      'internal_error',
      'Authentifizierung ist momentan nicht verfügbar, weil der Sitzungsspeicher nicht erreichbar ist.',
      { requestId }
    );
  }

  logger.error('Auth route failed unexpectedly', {
    endpoint: request.url,
    operation,
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'internal_auth_route_failure',
    request_id: requestId,
    ...buildLogContext(),
  });
  return toJsonErrorResponse(500, 'internal_error', 'Authentifizierung ist momentan nicht verfügbar.', {
    requestId,
  });
};

const attachDebugAuthHeaders = (
  response: Response,
  input: {
    request: Request;
    authConfig: {
      kind: 'platform' | 'instance';
      instanceId?: string;
      authRealm?: string;
      clientId: string;
      redirectUri: string;
    };
  }
): void => {
  if (!shouldAttachDebugAuthHeaders()) {
    return;
  }

  response.headers.set('x-sva-debug-request-host', resolveEffectiveRequestHost(input.request));
  response.headers.set('x-sva-debug-request-origin', buildRequestOriginFromHeaders(input.request));
  response.headers.set('x-sva-debug-auth-scope-kind', input.authConfig.kind);
  const debugInstanceId =
    input.authConfig.kind === 'instance'
      ? (input.authConfig.instanceId ?? PLATFORM_WORKSPACE_ID)
      : PLATFORM_WORKSPACE_ID;
  response.headers.set(
    'x-sva-debug-auth-instance-id',
    debugInstanceId
  );
  response.headers.set('x-sva-debug-auth-realm', input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID);
  response.headers.set('x-sva-debug-auth-client-id', input.authConfig.clientId);
  response.headers.set('x-sva-debug-auth-redirect-uri', input.authConfig.redirectUri);
};

const summarizeRedirectTarget = (
  value: string
): { redirect_target_origin?: string; redirect_target_path: string; has_sensitive_query: boolean } => {
  try {
    const url = new URL(value);
    return {
      redirect_target_origin: url.origin,
      redirect_target_path: url.pathname,
      has_sensitive_query: url.searchParams.has('id_token_hint') || url.searchParams.has('code'),
    };
  } catch {
    const [path] = value.split('?');
    return {
      redirect_target_path: path || value,
      has_sensitive_query: value.includes('id_token_hint=') || value.includes('code='),
    };
  }
};

const createAuthCookieOptions = () => {
  const isBuilderDevAuth = process.env.BUILDER_DEV_AUTH === 'true';

  return {
    httpOnly: true,
    secure: isBuilderDevAuth || process.env.NODE_ENV === 'production',
    sameSite: isBuilderDevAuth ? ('none' as const) : ('lax' as const),
    path: '/',
  };
};

const createTimedCookieOptions = (expiresAt: number | undefined) => {
  if (typeof expiresAt !== 'number') {
    return createAuthCookieOptions();
  }

  const maxAgeSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  return {
    ...createAuthCookieOptions(),
    maxAge: maxAgeSeconds,
    expires: new Date(Date.now() + maxAgeSeconds * 1000),
  };
};

const createSessionCookie = (name: string, sessionId: string, expiresAt?: number) =>
  serializeCookie(name, sessionId, createTimedCookieOptions(expiresAt));

const createLoginStateCookie = (input: { name: string; secret: string; payload: LoginStateCookiePayload }) =>
  serializeCookie(input.name, encodeLoginStateCookie(input.payload, input.secret), createAuthCookieOptions());

const createSilentSsoSuppressCookie = (name: string, suppressUntil: number) =>
  serializeCookie(name, String(suppressUntil), createTimedCookieOptions(suppressUntil));

const getSetCookieValues = (headers: Headers): string[] => {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
};

const describeTokenError = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const typed = error as {
    error?: unknown;
    error_description?: unknown;
    code?: unknown;
    cause?: unknown;
    response?: { status?: unknown };
  };
  const cause =
    typed.cause && typeof typed.cause === 'object'
      ? (typed.cause as {
          error?: unknown;
          error_description?: unknown;
          code?: unknown;
          response?: { status?: unknown };
        })
      : null;

  const readString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);
  const readStatus = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

  return {
    oauth_error: readString(typed.error) ?? readString(cause?.error),
    oauth_error_description:
      readString(typed.error_description) ?? readString(cause?.error_description),
    oauth_code: readString(typed.code) ?? readString(cause?.code),
    oauth_status: readStatus(typed.response?.status) ?? readStatus(cause?.response?.status),
  };
};

const attachLoginStateCookie = (
  response: Response,
  input: { name: string; secret: string; payload: LoginStateCookiePayload }
) => {
  appendSetCookie(response, createLoginStateCookie(input));
  return 'response';
};

const attachSessionCookie = (response: Response, name: string, sessionId: string, expiresAt?: number) => {
  appendSetCookie(response, createSessionCookie(name, sessionId, expiresAt));
  return 'response';
};

const attachSilentSsoSuppressCookie = (response: Response, name: string, suppressUntil: number) => {
  appendSetCookie(response, createSilentSsoSuppressCookie(name, suppressUntil));
  return 'response';
};

const attachDeletedCookie = (response: Response, name: string) => {
  appendSetCookie(response, deleteCookieHeader(name));
  return 'response';
};

const createSilentSsoResponse = (status: 'success' | 'failure') =>
  new Response(
    `<!doctype html><html><body><script>
window.parent.postMessage({ type: 'sva-auth:silent-sso', status: '${status}' }, window.location.origin);
</script></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );

const DEFAULT_POST_LOGIN_REDIRECT = '/';

const resolveCallbackInput = (request: Request) => {
  const url = new URL(request.url);
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
    iss: url.searchParams.get('iss'),
  };
};

const isTrustedAbsoluteReturnTo = async (request: Request, target: URL): Promise<boolean> => {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return false;
  }

  if (target.pathname.startsWith('/auth/')) {
    return false;
  }

  const config = getInstanceConfig();
  if (!config) {
    return false;
  }

  if (isCanonicalAuthHost(target.host)) {
    return true;
  }

  const classification = classifyHost(target.host, config.parentDomain);
  if (classification.kind !== 'tenant') {
    return false;
  }

  const registryEntry = await loadInstanceByHostname(target.host).catch(() => null);
  return Boolean(registryEntry && isTrafficEnabledInstanceStatus(registryEntry.status));
};

const sanitizeReturnTo = async (request: Request, value: string | null | undefined): Promise<string> => {
  if (!value) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//') || value.startsWith('/auth/')) {
      return DEFAULT_POST_LOGIN_REDIRECT;
    }
    return value;
  }

  try {
    const target = new URL(value);
    return (await isTrustedAbsoluteReturnTo(request, target)) ? target.toString() : DEFAULT_POST_LOGIN_REDIRECT;
  } catch {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }
};

const resolveCookieLoginState = async (request: Request, state: string) => {
  const { loginStateCookieName, loginStateSecret } = getAuthConfig();
  const payload = decodeLoginStateCookie(readCookieFromRequest(request, loginStateCookieName), loginStateSecret);

  if (!payload || payload.state !== state) {
    return null;
  }

  return {
    codeVerifier: payload.codeVerifier,
    nonce: payload.nonce,
    createdAt: payload.createdAt,
    returnTo: await sanitizeReturnTo(request, payload.returnTo),
    silent: payload.silent === true,
    ...(payload.kind === 'instance' ? { kind: 'instance' as const, instanceId: payload.instanceId } : { kind: 'platform' as const }),
  };
};

const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

const isSilentSsoSuppressed = (request: Request): boolean => {
  const { silentSsoSuppressCookieName } = getAuthConfig();
  const suppressUntil = Number(readCookieFromRequest(request, silentSsoSuppressCookieName) ?? '');
  return Number.isFinite(suppressUntil) && suppressUntil > Date.now();
};

export const loginHandler = async (request?: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-login');
    }

    try {
      const url = request ? new URL(request.url) : null;
      const isSilent = url?.searchParams.get('silent') === '1';
      if (request && isSilent && isSilentSsoSuppressed(request)) {
        return createSilentSsoResponse('failure');
      }

      const authConfig = request ? await resolveAuthConfigForRequest(request) : getAuthConfig();
      const authScope = getScopeFromAuthConfig(authConfig);
      const { loginStateCookieName, loginStateSecret } = authConfig;
      const returnTo = request ? await sanitizeReturnTo(request, url?.searchParams.get('returnTo')) : DEFAULT_POST_LOGIN_REDIRECT;
      const { url: authorizationUrl, state, loginState } = await createLoginUrl({
        returnTo,
        silent: isSilent,
        authConfig,
      });
      const response = createRedirectResponse(authorizationUrl);
      if (request) {
        attachDebugAuthHeaders(response, { request, authConfig });
      }

      logger.info('Login auth config resolved', {
        operation: 'login_auth_config_resolved',
        scope_kind: authScope.kind,
        request_url: request?.url,
        auth_instance_id: authConfig.kind === 'instance' ? authConfig.instanceId : null,
        auth_realm: authConfig.authRealm ?? null,
        auth_client_id: authConfig.clientId,
        auth_redirect_uri: authConfig.redirectUri,
        auth_issuer: authConfig.issuer,
        auth_scope_kind: authScope.kind,
        resolution_result: authScope.kind,
        ...buildLogContext(authScope),
      });

      logger.info('Login-Flow initiiert', {
        operation: 'login_init',
        scope_kind: authScope.kind,
        idp: 'keycloak',
        is_silent: isSilent,
        state: `${state.substring(0, 8)}...`,
        nonce: `${loginState.nonce.substring(0, 8)}...`,
        auth_instance_id: authConfig.kind === 'instance' ? authConfig.instanceId : null,
        auth_realm: authConfig.authRealm ?? null,
        auth_client_id: authConfig.clientId,
        auth_redirect_uri: authConfig.redirectUri,
        auth_issuer: authConfig.issuer,
        auth_scope_kind: authScope.kind,
        ...buildLogContext(authScope),
      });

      const loginStateCookieStrategy = attachLoginStateCookie(response, {
        name: loginStateCookieName,
        secret: loginStateSecret,
        payload: { state, ...loginState },
      });

      logger.info('Login state cookie prepared', {
        operation: 'login_init_cookie',
        strategy: loginStateCookieStrategy,
        response_set_cookie_count: getSetCookieValues(response.headers).length,
        is_silent: isSilent,
        ...buildLogContext(authScope),
      });

      return response;
    } catch (error) {
      return request
        ? createAuthDependencyErrorResponse(request, 'auth_login', error)
        : toJsonErrorResponse(500, 'internal_error', 'Authentifizierung ist momentan nicht verfügbar.');
    }
  });
};

export const callbackHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-callback');
    }

    try {
      const { code, state, error, iss } = resolveCallbackInput(request);
      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const { loginStateCookieName, sessionCookieName } = authConfig;
      const cookieLoginState = state ? await resolveCookieLoginState(request, state) : null;
      const hadSessionCookieOnCallback = Boolean(readCookieFromRequest(request, sessionCookieName));

      if (error) {
        const response = cookieLoginState?.silent ? createSilentSsoResponse('failure') : createRedirectResponse('/?auth=error');
        const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
        logger.info('Callback cookie cleanup prepared', {
          operation: 'login_callback_cookie_cleanup',
          strategy: loginStateDeleteStrategy,
          response_set_cookie_count: getSetCookieValues(response.headers).length,
          had_session_cookie_on_callback: hadSessionCookieOnCallback,
          ...buildLogContext(authScope),
        });
        await emitAuthAuditEvent({
          eventType: cookieLoginState?.silent ? 'silent_reauth_failed' : 'login',
          scope: cookieLoginState ?? authScope,
          workspaceId: getWorkspaceIdForScope(cookieLoginState ?? authScope),
          outcome: 'failure',
        });
        return response;
      }

      if (!code || !state) {
        return createRedirectResponse('/auth/login');
      }

      if (cookieLoginState && isExpiredLoginState(cookieLoginState.createdAt)) {
        const response = createRedirectResponse('/?auth=state-expired');
        const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
        logger.info('Expired callback cookie cleanup prepared', {
          operation: 'login_callback_cookie_cleanup',
          strategy: loginStateDeleteStrategy,
          response_set_cookie_count: getSetCookieValues(response.headers).length,
          had_session_cookie_on_callback: hadSessionCookieOnCallback,
          ...buildLogContext(cookieLoginState ?? authScope),
        });
        await emitAuthAuditEvent({
          eventType: 'login_state_expired',
          scope: cookieLoginState ?? authScope,
          workspaceId: getWorkspaceIdForScope(cookieLoginState ?? authScope),
          outcome: 'failure',
        });
        return response;
      }

      try {
        const { sessionId, user, expiresAt, loginState, retryPerformed } = await handleCallback({
          code,
          state,
          iss,
          loginState: cookieLoginState,
          authConfig,
        });
        const effectiveLoginState = loginState ?? cookieLoginState;
        const redirectTarget = effectiveLoginState?.returnTo ?? DEFAULT_POST_LOGIN_REDIRECT;
        const isSilent = effectiveLoginState?.silent === true;
        const response = isSilent ? createSilentSsoResponse('success') : createRedirectResponse(redirectTarget);

        logger.info('tenant_auth_callback_result', {
          operation: 'tenant_auth_callback',
          scope_kind: user.instanceId ? 'instance' : authScope.kind,
          instance_id: user.instanceId ?? (authConfig.kind === 'instance' ? authConfig.instanceId : undefined),
          auth_realm: authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
          client_id: authConfig.clientId,
          issuer: authConfig.issuer,
          redirect_uri: authConfig.redirectUri,
          is_silent: isSilent,
          retry_performed: retryPerformed,
          result: 'success',
          auth_scope_kind: authScope.kind,
          ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : authScope),
        });

        logger.info('Auth callback successful', {
          auth_flow: 'callback',
          operation: 'login_callback',
          is_silent: isSilent,
          session_created: true,
          redirect_target: redirectTarget,
          has_code: true,
          has_state: true,
          has_iss: Boolean(iss),
          ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : authScope),
        });

        const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
        const sessionCookieStrategy = attachSessionCookie(response, sessionCookieName, sessionId, expiresAt);
        const silentSsoDeleteStrategy = attachDeletedCookie(response, authConfig.silentSsoSuppressCookieName);
        logger.info('Callback cookies prepared', {
          operation: 'login_callback_cookies',
          login_state_delete_strategy: loginStateDeleteStrategy,
          session_cookie_strategy: sessionCookieStrategy,
          silent_sso_delete_strategy: silentSsoDeleteStrategy,
          response_set_cookie_count: getSetCookieValues(response.headers).length,
          had_session_cookie_on_callback: hadSessionCookieOnCallback,
          ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : authScope),
        });
        await emitAuthAuditEvent({
          eventType: isSilent ? 'silent_reauth_success' : 'login',
          actorUserId: user.id,
          scope: user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : authScope,
          workspaceId: user.instanceId ?? getWorkspaceIdForScope(authScope),
          outcome: 'success',
        });

        return response;
      } catch (error) {
        const isSilent = cookieLoginState?.silent === true;
        if (isTokenErrorLike(error)) {
          const callbackScope = cookieLoginState ?? authScope;
          logger.warn('Token validation failed in callback', {
            operation: 'token_validate',
            is_silent: isSilent,
            error_type: error instanceof Error ? error.constructor.name : typeof error,
            reason_code: 'token_validate_failed',
            has_refresh_token: false,
            ...describeTokenError(error),
            ...buildLogContext(callbackScope),
          });
          logger.warn('tenant_auth_callback_result', {
            operation: 'tenant_auth_callback',
            scope_kind: callbackScope.kind,
            instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
            auth_realm: authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
            client_id: authConfig.clientId,
            issuer: authConfig.issuer,
            redirect_uri: authConfig.redirectUri,
            is_silent: isSilent,
            retry_performed: false,
            result: 'failure',
            auth_scope_kind: authScope.kind,
            ...describeTokenError(error),
            ...buildLogContext(callbackScope),
          });
        } else {
          const callbackScope = cookieLoginState ?? authScope;
          logger.error('Auth callback failed', {
            auth_flow: 'callback',
            operation: 'login_callback',
            is_silent: isSilent,
            error_type: error instanceof Error ? error.constructor.name : typeof error,
            reason_code: 'callback_failed',
            has_code: true,
            has_state: true,
            has_iss: Boolean(iss),
            ...buildLogContext(callbackScope),
          });
          logger.error('tenant_auth_callback_result', {
            operation: 'tenant_auth_callback',
            scope_kind: callbackScope.kind,
            instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
            auth_realm: authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
            client_id: authConfig.clientId,
            issuer: authConfig.issuer,
            redirect_uri: authConfig.redirectUri,
            is_silent: isSilent,
            retry_performed: false,
            result: 'failure',
            error_type: error instanceof Error ? error.constructor.name : typeof error,
            reason_code: 'callback_failed',
            auth_scope_kind: authScope.kind,
            ...buildLogContext(callbackScope),
          });
        }

        const response = isSilent ? createSilentSsoResponse('failure') : createRedirectResponse('/?auth=error');
        const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
        logger.info('Failed callback cookie cleanup prepared', {
          operation: 'login_callback_cookie_cleanup',
          strategy: loginStateDeleteStrategy,
          response_set_cookie_count: getSetCookieValues(response.headers).length,
          had_session_cookie_on_callback: hadSessionCookieOnCallback,
          ...buildLogContext(cookieLoginState ?? authScope),
        });
        await emitAuthAuditEvent({
          eventType: isSilent ? 'silent_reauth_failed' : 'login',
          scope: cookieLoginState ?? authScope,
          workspaceId: getWorkspaceIdForScope(cookieLoginState ?? authScope),
          outcome: 'failure',
        });
        return response;
      }
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_callback', error);
    }
  });
};

export const meHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return new Response(JSON.stringify({ user: createMockSessionUser() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('Auth me request received', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      cookie_header_present: Boolean(request.headers.get('cookie')),
      session_cookie_present: Boolean(readCookieFromRequest(request, getAuthConfig().sessionCookieName)),
      ...buildLogContext(),
    });

    return withAuthenticatedUser(request, ({ user }) => {
      logger.debug('Auth check successful', {
        endpoint: '/auth/me',
          auth_state: 'authenticated',
          operation: 'get_current_user',
          roles_count: user.roles?.length ?? 0,
          ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : undefined),
      });

      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });
};

export const logoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-logout');
    }

    try {
      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const { sessionCookieName, postLogoutRedirectUri, silentSsoSuppressCookieName, silentSsoSuppressAfterLogoutMs } =
        authConfig;
      const sessionId = readCookieFromRequest(request, sessionCookieName);
      let logoutUrl = postLogoutRedirectUri;

      if (sessionId) {
        try {
          const sessionBeforeLogout = await getSession(sessionId);
          logoutUrl = await logoutSession(sessionId, authConfig);

          logger.info('Logout successful', {
            endpoint: '/auth/logout',
            operation: 'logout',
            ...summarizeRedirectTarget(logoutUrl),
            ...buildLogContext(sessionBeforeLogout?.user?.instanceId
              ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId }
              : authScope),
          });

          await emitAuthAuditEvent({
            eventType: 'logout',
            actorUserId: sessionBeforeLogout?.user?.id ?? sessionBeforeLogout?.userId,
            scope: sessionBeforeLogout?.user?.instanceId
              ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId }
              : authScope,
            workspaceId:
              sessionBeforeLogout?.user?.instanceId
                ?? getWorkspaceIdForScope(authScope),
            outcome: 'success',
          });
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
        }
      } else {
        logger.debug('Logout without session', {
          endpoint: '/auth/logout',
          operation: 'logout',
          session_exists: false,
          ...buildLogContext(authScope),
        });
      }

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
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_logout', error);
    }
  });
};
