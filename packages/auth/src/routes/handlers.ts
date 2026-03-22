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

const createAuthCookieOptions = () => {
  const isBuilderDevAuth = process.env.BUILDER_DEV_AUTH === 'true';

  return {
    httpOnly: true,
    secure: isBuilderDevAuth || process.env.NODE_ENV === 'production',
    sameSite: isBuilderDevAuth ? ('none' as const) : ('lax' as const),
    path: '/',
  };
};

const createSessionCookie = (name: string, sessionId: string) =>
  serializeCookie(name, sessionId, createAuthCookieOptions());

const createLoginStateCookie = (input: { name: string; secret: string; payload: LoginStateCookiePayload }) =>
  serializeCookie(input.name, encodeLoginStateCookie(input.payload, input.secret), createAuthCookieOptions());

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
  };
};

const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

export const loginHandler = async (request?: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-login');
    }

    const { url, state, loginState } = await createLoginUrl();
    const { loginStateCookieName, loginStateSecret } = getAuthConfig();
    const response = createRedirectResponse(url);

    logger.info('Login-Flow initiiert', {
      operation: 'login_init',
      idp: 'keycloak',
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

    if (error) {
      return createRedirectResponse('/?auth=error');
    }

    if (!code || !state) {
      return createRedirectResponse('/auth/login');
    }

    const cookieLoginState = resolveCookieLoginState(request, state);
    if (cookieLoginState && isExpiredLoginState(cookieLoginState.createdAt)) {
      const response = createRedirectResponse('/?auth=state-expired');
      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
      return response;
    }

    try {
      const { sessionId, user } = await handleCallback({ code, state, iss, loginState: cookieLoginState });
      const response = createRedirectResponse('/?auth=ok');

      logger.info('Auth callback successful', {
        auth_flow: 'callback',
        operation: 'login_callback',
        session_created: true,
        redirect_target: '/?auth=ok',
        has_code: true,
        has_state: true,
        has_iss: Boolean(iss),
        ...buildLogContext(),
      });

      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
      appendSetCookie(response, createSessionCookie(sessionCookieName, sessionId));
      await emitAuthAuditEvent({
        eventType: 'login',
        actorUserId: user.id,
        actorEmail: user.email,
        actorDisplayName: user.name,
        workspaceId: user.instanceId,
        outcome: 'success',
      });

      return response;
    } catch (error) {
      if (isTokenErrorLike(error)) {
        logger.warn('Token validation failed in callback', {
          operation: 'token_validate',
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          has_refresh_token: false,
          ...buildLogContext(),
        });
      } else {
        logger.error('Auth callback failed', {
          auth_flow: 'callback',
          operation: 'login_callback',
          error: error instanceof Error ? error.message : String(error),
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          has_code: true,
          has_state: true,
          has_iss: Boolean(iss),
          ...buildLogContext(),
        });
      }

      const response = createRedirectResponse('/?auth=error');
      appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
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
        user_id: user.id,
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

    const { sessionCookieName, postLogoutRedirectUri } = getAuthConfig();
    const sessionId = readCookieFromRequest(request, sessionCookieName);
    let logoutUrl = postLogoutRedirectUri;

    if (sessionId) {
      try {
        const sessionBeforeLogout = await getSession(sessionId);
        logoutUrl = await logoutSession(sessionId);

        logger.info('Logout successful', {
          endpoint: '/auth/logout',
          operation: 'logout',
          redirect_target: logoutUrl,
          ...buildLogContext(),
        });

        await emitAuthAuditEvent({
          eventType: 'logout',
          actorUserId: sessionBeforeLogout?.user?.id ?? sessionBeforeLogout?.userId,
          actorEmail: sessionBeforeLogout?.user?.email,
          actorDisplayName: sessionBeforeLogout?.user?.name,
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
    return response;
  });
};
