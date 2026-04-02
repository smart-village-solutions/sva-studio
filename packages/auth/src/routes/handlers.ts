import { serialize as serializeCookie } from 'cookie-es';
import { classifyHost, isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data/server';
import { createSdkLogger, getInstanceConfig, initializeOtelSdk, isCanonicalAuthHost, withRequestContext } from '@sva/sdk/server';

import { createLoginUrl, handleCallback, logoutSession } from '../auth.server.js';
import { emitAuthAuditEvent } from '../audit-events.server.js';
import { getAuthConfig } from '../config.js';
import { createMockSessionUser, isMockAuthEnabled } from '../mock-auth.server.js';
import { getSession } from '../redis-session.server.js';
import { isTokenErrorLike } from '../shared/error-guards.js';
import { buildLogContext } from '../shared/log-context.js';
import { withAuthenticatedUser } from '../middleware.server.js';
import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';
import { decodeLoginStateCookie, encodeLoginStateCookie, type LoginStateCookiePayload } from './login-state-cookie.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

initializeOtelSdk().catch((error: unknown) => {
  logger.error('Fehler bei OTEL SDK Initialisierung im Auth-Modul', {
    error: error instanceof Error ? error.message : String(error),
    component: 'iam-auth',
    ...buildLogContext('default'),
  });
});

const createRedirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location },
  });

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

const buildCanonicalAuthUrl = (request: Request, pathname: string, searchParams?: URLSearchParams): URL => {
  const requestUrl = new URL(request.url);
  const config = getInstanceConfig();
  const target = new URL(requestUrl.toString());
  const portSuffix = requestUrl.port ? `:${requestUrl.port}` : '';
  target.host = `${config?.canonicalAuthHost ?? requestUrl.hostname}${portSuffix}`;
  target.pathname = pathname;
  target.search = searchParams ? searchParams.toString() : '';
  return target;
};

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
  };
};

const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

const redirectTenantLoginToCanonicalHost = async (request: Request): Promise<Response | null> => {
  const config = getInstanceConfig();
  if (!config) {
    return null;
  }

  const requestUrl = new URL(request.url);
  if (isCanonicalAuthHost(requestUrl.host)) {
    return null;
  }

  const hostClassification = classifyHost(requestUrl.host, config.parentDomain);
  if (hostClassification.kind !== 'tenant') {
    return null;
  }

  const requestedReturnTo = await sanitizeReturnTo(request, requestUrl.searchParams.get('returnTo'));
  const tenantReturnTo = requestedReturnTo.startsWith('/')
    ? `${requestUrl.origin}${requestedReturnTo}`
    : requestedReturnTo;
  const redirectParams = new URLSearchParams({ returnTo: tenantReturnTo });

  if (requestUrl.searchParams.get('silent') === '1') {
    redirectParams.set('silent', '1');
  }

  return createRedirectResponse(buildCanonicalAuthUrl(request, '/auth/login', redirectParams).toString());
};

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

    if (request) {
      const canonicalRedirect = await redirectTenantLoginToCanonicalHost(request);
      if (canonicalRedirect) {
        return canonicalRedirect;
      }
    }

    const url = request ? new URL(request.url) : null;
    const isSilent = url?.searchParams.get('silent') === '1';
    if (request && isSilent && isSilentSsoSuppressed(request)) {
      return createSilentSsoResponse('failure');
    }

    const { loginStateCookieName, loginStateSecret } = getAuthConfig();
    const returnTo = request ? await sanitizeReturnTo(request, url?.searchParams.get('returnTo')) : DEFAULT_POST_LOGIN_REDIRECT;
    const { url: authorizationUrl, state, loginState } = await createLoginUrl({ returnTo, silent: isSilent });
    const response = createRedirectResponse(authorizationUrl);

    logger.info('Login-Flow initiiert', {
      operation: 'login_init',
      idp: 'keycloak',
      is_silent: isSilent,
      state: `${state.substring(0, 8)}...`,
      nonce: `${loginState.nonce.substring(0, 8)}...`,
      ...buildLogContext(),
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
      ...buildLogContext(),
    });

    return response;
  });
};

export const callbackHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-callback');
    }

    const { code, state, error, iss } = resolveCallbackInput(request);
    const { loginStateCookieName, sessionCookieName } = getAuthConfig();
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
        ...buildLogContext(),
      });
      await emitAuthAuditEvent({
        eventType: cookieLoginState?.silent ? 'silent_reauth_failed' : 'login',
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
        ...buildLogContext(),
      });
      await emitAuthAuditEvent({
        eventType: 'login_state_expired',
        outcome: 'failure',
      });
      return response;
    }

    try {
      const { sessionId, user, expiresAt, loginState } = await handleCallback({ code, state, iss, loginState: cookieLoginState });
      const effectiveLoginState = loginState ?? cookieLoginState;
      const redirectTarget = effectiveLoginState?.returnTo ?? DEFAULT_POST_LOGIN_REDIRECT;
      const isSilent = effectiveLoginState?.silent === true;
      const response = isSilent ? createSilentSsoResponse('success') : createRedirectResponse(redirectTarget);

      logger.info('Auth callback successful', {
        auth_flow: 'callback',
        operation: 'login_callback',
        is_silent: isSilent,
        session_created: true,
        redirect_target: redirectTarget,
        has_code: true,
        has_state: true,
        has_iss: Boolean(iss),
        ...buildLogContext(),
      });

      const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
      const sessionCookieStrategy = attachSessionCookie(response, sessionCookieName, sessionId, expiresAt);
      const silentSsoDeleteStrategy = attachDeletedCookie(response, getAuthConfig().silentSsoSuppressCookieName);
      logger.info('Callback cookies prepared', {
        operation: 'login_callback_cookies',
        login_state_delete_strategy: loginStateDeleteStrategy,
        session_cookie_strategy: sessionCookieStrategy,
        silent_sso_delete_strategy: silentSsoDeleteStrategy,
        response_set_cookie_count: getSetCookieValues(response.headers).length,
        had_session_cookie_on_callback: hadSessionCookieOnCallback,
        ...buildLogContext(user.instanceId),
      });
      await emitAuthAuditEvent({
        eventType: isSilent ? 'silent_reauth_success' : 'login',
        actorUserId: user.id,
        workspaceId: user.instanceId,
        outcome: 'success',
      });

      return response;
    } catch (error) {
      const isSilent = cookieLoginState?.silent === true;
      if (isTokenErrorLike(error)) {
        logger.warn('Token validation failed in callback', {
          operation: 'token_validate',
          is_silent: isSilent,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          has_refresh_token: false,
          ...buildLogContext(),
        });
      } else {
        logger.error('Auth callback failed', {
          auth_flow: 'callback',
          operation: 'login_callback',
          is_silent: isSilent,
          error: error instanceof Error ? error.message : String(error),
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          has_code: true,
          has_state: true,
          has_iss: Boolean(iss),
          ...buildLogContext(),
        });
      }

      const response = isSilent ? createSilentSsoResponse('failure') : createRedirectResponse('/?auth=error');
      const loginStateDeleteStrategy = attachDeletedCookie(response, loginStateCookieName);
      logger.info('Failed callback cookie cleanup prepared', {
        operation: 'login_callback_cookie_cleanup',
        strategy: loginStateDeleteStrategy,
        response_set_cookie_count: getSetCookieValues(response.headers).length,
        had_session_cookie_on_callback: hadSessionCookieOnCallback,
        ...buildLogContext(),
      });
      await emitAuthAuditEvent({
        eventType: isSilent ? 'silent_reauth_failed' : 'login',
        outcome: 'failure',
      });
      return response;
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
        ...buildLogContext(user.instanceId),
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

    const { sessionCookieName, postLogoutRedirectUri, silentSsoSuppressCookieName, silentSsoSuppressAfterLogoutMs } =
      getAuthConfig();
    const sessionId = readCookieFromRequest(request, sessionCookieName);
    let logoutUrl = postLogoutRedirectUri;

    if (sessionId) {
      try {
        const sessionBeforeLogout = await getSession(sessionId);
        logoutUrl = await logoutSession(sessionId);

        logger.info('Logout successful', {
          endpoint: '/auth/logout',
          operation: 'logout',
          ...summarizeRedirectTarget(logoutUrl),
          ...buildLogContext(),
        });

        await emitAuthAuditEvent({
          eventType: 'logout',
          actorUserId: sessionBeforeLogout?.user?.id ?? sessionBeforeLogout?.userId,
          workspaceId: sessionBeforeLogout?.user?.instanceId,
          outcome: 'success',
        });
      } catch (error) {
        logger.error('Logout failed', {
          endpoint: '/auth/logout',
          operation: 'logout',
          error: error instanceof Error ? error.message : String(error),
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          ...buildLogContext(),
        });
      }
    } else {
      logger.debug('Logout without session', {
        endpoint: '/auth/logout',
        operation: 'logout',
        session_exists: false,
        ...buildLogContext(),
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
      ...buildLogContext(),
    });
    return response;
  });
};
