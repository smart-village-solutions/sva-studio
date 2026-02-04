import { createHmac, timingSafeEqual } from 'node:crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie-es';

import { createLoginUrl, getSessionUser, handleCallback, logoutSession } from './auth.server';
import { getAuthConfig } from './config';
import type { AuthRoutePath } from './routes.shared';
import type { LoginState } from './types';

type LoginStateCookiePayload = LoginState & {
  state: string;
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
  const { url, state, loginState } = await createLoginUrl();
  const { loginStateCookieName, loginStateSecret } = getAuthConfig();
  const cookiePayload: LoginStateCookiePayload = { state, ...loginState };

  const cookie = serializeCookie(
    loginStateCookieName,
    encodeLoginStateCookie(cookiePayload, loginStateSecret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    }
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': cookie,
    }
  });
};

/**
 * Handles the IdP callback, creates a session, and redirects to the app.
 */
export const callbackHandler = async (request: Request): Promise<Response> => {
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
  const cookies = parseCookie(request.headers.get('Cookie') || '');
  const loginStateCookie = decodeLoginStateCookie(cookies[loginStateCookieName], loginStateSecret);
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
    const deleteCookie = serializeCookie(loginStateCookieName, '', {
      path: '/',
      maxAge: 0,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/?auth=state-expired',
        'Set-Cookie': deleteCookie,
      },
    });
  }

  try {
    const { sessionId } = await handleCallback({
      code,
      state,
      iss,
      loginState: cookieLoginState,
    });

    console.log('[AUTH] Session created:', sessionId);

    const sessionCookie = serializeCookie(sessionCookieName, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    const deleteCookie = serializeCookie(loginStateCookieName, '', {
      path: '/',
      maxAge: 0,
    });

    console.log('[AUTH] Setting session cookie:', sessionCookie);
    console.log('[AUTH] Deleting login state cookie');

    // Use 302 redirect with proper Location header - browser should respect Set-Cookie with this
    const headers = new Headers();
    headers.set('Location', '/?auth=ok');
    headers.append('Set-Cookie', sessionCookie);
    headers.append('Set-Cookie', deleteCookie);

    console.log('[AUTH] Returning 302 redirect');
    console.log('[AUTH] Headers:', Array.from(headers.entries()));

    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Auth callback error:', error);
    const deleteCookie = serializeCookie(loginStateCookieName, '', {
      path: '/',
      maxAge: 0,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/?auth=error',
        'Set-Cookie': deleteCookie,
      },
    });
  }
};

/**
 * Returns the current user profile for the active session.
 */
export const meHandler = async (request: Request): Promise<Response> => {
  const { sessionCookieName } = getAuthConfig();
  const cookieHeader = request.headers.get('Cookie') || '';

  console.log('[AUTH] /auth/me request');
  console.log('[AUTH] Cookie header from browser:', cookieHeader);

  const cookies = parseCookie(cookieHeader);
  const sessionId = cookies[sessionCookieName];

  console.log('[AUTH] Parsed cookies:', Object.keys(cookies));
  console.log('[AUTH] Session ID:', sessionId);

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await getSessionUser(sessionId);
  console.log('[AUTH] User from session:', user ? user.id : 'null');

  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Ends the session and redirects to the post-logout URL.
 */
export const logoutHandler = async (request: Request): Promise<Response> => {
  const { sessionCookieName, postLogoutRedirectUri } = getAuthConfig();
  const cookies = parseCookie(request.headers.get('Cookie') || '');
  const sessionId = cookies[sessionCookieName];

  let logoutUrl = postLogoutRedirectUri;
  if (sessionId) {
    try {
      logoutUrl = await logoutSession(sessionId);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const deleteCookie = serializeCookie(sessionCookieName, '', {
    path: '/',
    maxAge: 0,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: logoutUrl,
      'Set-Cookie': deleteCookie,
    }
  });
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
