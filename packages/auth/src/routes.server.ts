import { createLoginUrl, getSessionUser, handleCallback, logoutSession } from './auth.server';
import { getAuthConfig } from './config';
import type { AuthRoutePath } from './routes.shared';

/**
 * Cookie serialization options for response headers.
 */
type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
  maxAge?: number;
};

/**
 * Serializes a cookie name/value pair with the provided options.
 */
const serializeCookie = (name: string, value: string, options: CookieOptions) => {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (options.httpOnly) cookie += '; HttpOnly';
  if (options.secure) cookie += '; Secure';
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  return cookie;
};

/**
 * Creates a cookie string that expires immediately for deletion.
 */
const deleteCookie = (name: string, path: string) =>
  `${encodeURIComponent(name)}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

/**
 * Parses the Cookie header into a name/value map.
 */
const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [key, ...rest] = cookie.trim().split('=');
      return [decodeURIComponent(key), decodeURIComponent(rest.join('='))];
    })
  );
};

/**
 * Redirects to the IdP login URL and stores the login state in a cookie.
 */
export const loginHandler = async (): Promise<Response> => {
  const { url, state } = await createLoginUrl();
  const { loginStateCookieName } = getAuthConfig();

  const headers = new Headers({ Location: url });
  headers.append(
    'Set-Cookie',
    serializeCookie(loginStateCookieName, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
    })
  );

  return new Response(null, { status: 302, headers });
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

  const { loginStateCookieName, sessionCookieName } = getAuthConfig();

  try {
    const { sessionId } = await handleCallback({ code, state, iss });
    const headers = new Headers({ Location: '/' });

    headers.append(
      'Set-Cookie',
      serializeCookie(sessionCookieName, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/',
      })
    );
    headers.append('Set-Cookie', deleteCookie(loginStateCookieName, '/'));

    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('Auth callback error:', error);
    return new Response(null, {
      status: 302,
      headers: { Location: '/?auth=error' },
    });
  }
};

/**
 * Returns the current user profile for the active session.
 */
export const meHandler = async (request: Request): Promise<Response> => {
  const { sessionCookieName } = getAuthConfig();
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies[sessionCookieName];

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await getSessionUser(sessionId);
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
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies[sessionCookieName];

  let logoutUrl = postLogoutRedirectUri;
  if (sessionId) {
    try {
      logoutUrl = await logoutSession(sessionId);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const headers = new Headers({ Location: logoutUrl });
  headers.append('Set-Cookie', deleteCookie(sessionCookieName, '/'));

  return new Response(null, { status: 302, headers });
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
