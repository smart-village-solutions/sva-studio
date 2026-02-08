import { createHmac, timingSafeEqual } from 'node:crypto';
import { deleteCookie, getCookie, getResponseHeaders, setCookie } from '@tanstack/react-start/server';
import { createSdkLogger, withRequestContext } from '@sva/sdk';

import { createLoginUrl, getSessionUser, handleCallback, logoutSession } from './auth.server';
import { getAuthConfig } from './config';
import type { AuthRoutePath } from './routes.shared';
import type { LoginState } from './types';

const logger = createSdkLogger({ component: 'auth', level: 'info' });

type LoginStateCookiePayload = LoginState & {
  state: string;
};

const attachStartSetCookieHeaders = (response: Response): Response => {
  const headers = getResponseHeaders();
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => Array<string>;
  };

  const setCookies =
    typeof headersWithGetSetCookie.getSetCookie === 'function'
      ? headersWithGetSetCookie.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie') ?? '']
        : [];

  for (const cookie of setCookies) {
    if (cookie) {
      response.headers.append('set-cookie', cookie);
    }
  }

  return response;
};

const encodeLoginStateCookie = (payload: LoginStateCookiePayload, secret: string) => {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
};

const decodeLoginStateCookie = (value: string | undefined, secret: string) => {
  if (!value) return null;
  const [data, signature] = value.split('.');
  if (!data || !signature) return null;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as LoginStateCookiePayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Redirects to the IdP login URL and stores the login state in a cookie.
 */
export const loginHandler = async (): Promise<Response> => {
  return withRequestContext(
    { fallbackWorkspaceId: 'default' },
    async () => {
      const { url, state, loginState } = await createLoginUrl();
      const { loginStateCookieName, loginStateSecret } = getAuthConfig();
      const cookiePayload: LoginStateCookiePayload = { state, ...loginState };

  // Use TanStack Start cookie API
  setCookie(
    loginStateCookieName,
    encodeLoginStateCookie(cookiePayload, loginStateSecret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    }
  );

      // Redirect to Keycloak
      return attachStartSetCookieHeaders(
        new Response(null, {
          status: 302,
          headers: { Location: url },
        })
      );
    }
  );
};

/**
 * Handles the IdP callback, creates a session, and redirects to the app.
 */
export const callbackHandler = async (request: Request): Promise<Response> => {
  return withRequestContext(
    { request, fallbackWorkspaceId: 'default' },
    async () => {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const iss = url.searchParams.get('iss');

  if (error) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/?auth=error' },
    });
  }

  if (!code || !state) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/auth/login' },
    });
  }

  const { loginStateCookieName, loginStateSecret, sessionCookieName } = getAuthConfig();

  // Use TanStack Start getCookie API
  const loginStateCookieValue = await getCookie(loginStateCookieName);
  const loginStateCookie = decodeLoginStateCookie(loginStateCookieValue, loginStateSecret);

  const now = Date.now();
  const cookieLoginState =
    loginStateCookie && loginStateCookie.state === state
      ? {
          codeVerifier: loginStateCookie.codeVerifier,
          nonce: loginStateCookie.nonce,
          createdAt: loginStateCookie.createdAt,
        }
      : null;

  if (cookieLoginState && now - cookieLoginState.createdAt > 10 * 60 * 1000) {
    deleteCookie(loginStateCookieName, { path: '/' });
    return attachStartSetCookieHeaders(
      new Response(null, {
        status: 302,
        headers: { Location: '/?auth=state-expired' },
      })
    );
  }

  try {
    const { sessionId } = await handleCallback({
      code,
      state,
      iss,
      loginState: cookieLoginState,
    });

    logger.info('Auth callback successful', {
      auth_flow: 'callback',
      session_created: true,
      redirect_target: '/?auth=ok',
      has_code: !!code,
      has_state: !!state,
      has_iss: !!iss,
    });

    // ✅ Use TanStack Start cookie APIs
    deleteCookie(loginStateCookieName, { path: '/' });

    setCookie(sessionCookieName, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return attachStartSetCookieHeaders(
      new Response(null, {
        status: 302,
        headers: { Location: '/?auth=ok' },
      })
    );
  } catch (error) {
    logger.error('Auth callback failed', {
      auth_flow: 'callback',
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      has_code: !!code,
      has_state: !!state,
      has_iss: !!iss,
    });
    deleteCookie(loginStateCookieName, { path: '/' });
    return attachStartSetCookieHeaders(
      new Response(null, {
        status: 302,
        headers: { Location: '/?auth=error' },
      })
    );
  }
    }
  );
};

/**
 * Returns the current user profile for the active session.
 */
export const meHandler = async (request: Request): Promise<Response> => {
  return withRequestContext(
    { request, fallbackWorkspaceId: 'default' },
    async () => {
      const { sessionCookieName } = getAuthConfig();

  // Use TanStack Start getCookie API
  const sessionId = await getCookie(sessionCookieName);

  if (!sessionId) {
    logger.debug('Auth check - no session', {
      endpoint: '/auth/me',
      auth_state: 'unauthenticated',
    });
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await getSessionUser(sessionId);

  if (!user) {
    logger.warn('Session found but user invalid', {
      endpoint: '/auth/me',
      session_exists: true,
      user_exists: false,
    });
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logger.debug('Auth check successful', {
    endpoint: '/auth/me',
    auth_state: 'authenticated',
    user_id: user.id,
    roles_count: user.roles?.length ?? 0,
  });

      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  );
};

/**
 * Ends the session and redirects to the post-logout URL.
 */
export const logoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext(
    { request, fallbackWorkspaceId: 'default' },
    async () => {
      const { sessionCookieName, postLogoutRedirectUri } = getAuthConfig();

      // Use TanStack Start getCookie API
      const sessionId = await getCookie(sessionCookieName);

      let logoutUrl = postLogoutRedirectUri;
      if (sessionId) {
        try {
          logoutUrl = await logoutSession(sessionId);
          logger.info('Logout successful', {
            endpoint: '/auth/logout',
            redirect_target: logoutUrl,
          });
        } catch (error) {
          logger.error('Logout failed', {
            endpoint: '/auth/logout',
            error: error instanceof Error ? error.message : String(error),
            error_type: error instanceof Error ? error.constructor.name : typeof error,
          });
        }
      } else {
        logger.debug('Logout without session', {
          endpoint: '/auth/logout',
          session_exists: false,
        });
      }

      // Use TanStack Start deleteCookie API
      deleteCookie(sessionCookieName, { path: '/' });

      return attachStartSetCookieHeaders(
        new Response(null, {
          status: 302,
          headers: { Location: logoutUrl },
        })
      );
    }
  );
};

/**
 * Declarative auth routes with typed handlers.
 */
export type AuthRouteDefinition = {
  path: AuthRoutePath;
  handlers: {
    GET?: (ctx: { request: Request }) => Promise<Response> | Response;
    POST?: (ctx: { request: Request }) => Promise<Response> | Response;
  };
};

/**
 * Auth route registry consumed by the server router.
 */
export const authRouteDefinitions: AuthRouteDefinition[] = [
  {
    path: '/auth/login',
    handlers: {
      GET: async () => loginHandler(),
    },
  },
  {
    path: '/auth/callback',
    handlers: {
      GET: async ({ request }) => callbackHandler(request),
    },
  },
  {
    path: '/auth/me',
    handlers: {
      GET: async ({ request }) => meHandler(request),
    },
  },
  {
    path: '/auth/logout',
    handlers: {
      POST: async ({ request }) => logoutHandler(request),
    },
  },
];
