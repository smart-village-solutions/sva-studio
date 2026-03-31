import { serialize as serializeCookie } from 'cookie-es';
import { createSdkLogger, initializeOtelSdk, withRequestContext } from '@sva/sdk/server';

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

const resolveCookieLoginState = (request: Request, state: string) => {
  const { loginStateCookieName, loginStateSecret } = getAuthConfig();
  const payload = decodeLoginStateCookie(readCookieFromRequest(request, loginStateCookieName), loginStateSecret);

  if (!payload || payload.state !== state) {
    return null;
  }

  return {
    codeVerifier: payload.codeVerifier,
    nonce: payload.nonce,
    createdAt: payload.createdAt,
    returnTo: sanitizeReturnTo(payload.returnTo),
    silent: payload.silent === true,
  };
};

const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

const sanitizeReturnTo = (value: string | null | undefined): string => {
  if (!value) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }

  if (value.startsWith('/auth/')) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }

  return value;
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

    const url = request ? new URL(request.url) : null;
    const isSilent = url?.searchParams.get('silent') === '1';
    if (request && isSilent && isSilentSsoSuppressed(request)) {
      return createSilentSsoResponse('failure');
    }

    const { loginStateCookieName, loginStateSecret } = getAuthConfig();
    const returnTo = request ? sanitizeReturnTo(url?.searchParams.get('returnTo')) : DEFAULT_POST_LOGIN_REDIRECT;
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

    appendSetCookie(
      response,
      createLoginStateCookie({
        name: loginStateCookieName,
        secret: loginStateSecret,
        payload: { state, ...loginState },
      })
    );

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
    const cookieLoginState = state ? resolveCookieLoginState(request, state) : null;

    if (error) {
      const response = cookieLoginState?.silent ? createSilentSsoResponse('failure') : createRedirectResponse('/?auth=error');
      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
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
      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
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

      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
      appendSetCookie(response, createSessionCookie(sessionCookieName, sessionId, expiresAt));
      appendSetCookie(response, deleteCookieHeader(getAuthConfig().silentSsoSuppressCookieName));
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
      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
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
    appendSetCookie(response, deleteCookieHeader(sessionCookieName));
    appendSetCookie(
      response,
      createSilentSsoSuppressCookie(silentSsoSuppressCookieName, Date.now() + silentSsoSuppressAfterLogoutMs)
    );
    return response;
  });
};
