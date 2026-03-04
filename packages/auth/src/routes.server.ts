import { createHmac, timingSafeEqual } from 'node:crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie-es';
import { createSdkLogger, withRequestContext, initializeOtelSdk } from '@sva/sdk/server';

import { createLoginUrl, handleCallback, logoutSession } from './auth.server';
import { emitAuthAuditEvent } from './audit-events.server';
import { getAuthConfig } from './config';
import { buildLogContext, isTokenErrorLike } from './log-context.server';
import { governanceComplianceExportHandler, governanceWorkflowHandler } from './iam-governance.server';
import { withAuthenticatedUser } from './middleware.server';
import { getSession } from './redis-session.server';
import type { AuthRoutePath } from './routes.shared';
import type { LoginState } from './types';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

// Fire-and-forget: SDK wird asynchron initialisiert.
initializeOtelSdk().catch((error: unknown) => {
  logger.error('Fehler bei OTEL SDK Initialisierung im Auth-Modul', {
    error: error instanceof Error ? error.message : String(error),
    component: 'iam-auth',
    ...buildLogContext('default'),
  });
});

type LoginStateCookiePayload = LoginState & {
  state: string;
};

const readCookieFromRequest = (request: Request, name: string): string | undefined => {
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[name];
};

const appendSetCookie = (response: Response, cookie: string) => {
  response.headers.append('set-cookie', cookie);
};

const deleteCookieHeader = (name: string) =>
  serializeCookie(name, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

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
export const loginHandler = async (request?: Request): Promise<Response> => {
  return withRequestContext(
    { request, fallbackWorkspaceId: 'default' },
    async () => {
      const { url, state, loginState } = await createLoginUrl();
      const { loginStateCookieName, loginStateSecret } = getAuthConfig();
      const cookiePayload: LoginStateCookiePayload = { state, ...loginState };

      logger.info('Login-Flow initiiert', {
        operation: 'login_init',
        idp: 'keycloak',
        state: state.substring(0, 8) + '...', // Nur Prefix für Security
        nonce: loginState.nonce.substring(0, 8) + '...',
        ...buildLogContext(),
      });

      const loginStateCookie = serializeCookie(
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
      const response = new Response(null, {
        status: 302,
        headers: { Location: url },
      });
      appendSetCookie(response, loginStateCookie);
      return response;
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

  const loginStateCookieValue = readCookieFromRequest(request, loginStateCookieName);
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
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/?auth=state-expired' },
    });
    appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
    return response;
  }

  try {
    const { sessionId, user } = await handleCallback({
      code,
      state,
      iss,
      loginState: cookieLoginState,
    });

    logger.info('Auth callback successful', {
      auth_flow: 'callback',
      operation: 'login_callback',
      session_created: true,
      redirect_target: '/?auth=ok',
      has_code: !!code,
      has_state: !!state,
      has_iss: !!iss,
      ...buildLogContext(),
    });

    const response = new Response(null, {
      status: 302,
      headers: { Location: '/?auth=ok' },
    });
    appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
    appendSetCookie(
      response,
      serializeCookie(sessionCookieName, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
    );
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
        has_code: !!code,
        has_state: !!state,
        has_iss: !!iss,
        ...buildLogContext(),
      });
    }
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/?auth=error' },
    });
    appendSetCookie(response, deleteCookieHeader(loginStateCookieName));
    return response;
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

      const response = new Response(null, {
        status: 302,
        headers: { Location: logoutUrl },
      });
      appendSetCookie(response, deleteCookieHeader(sessionCookieName));
      return response;
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
      GET: async ({ request }) => loginHandler(request),
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
  {
    path: '/iam/governance/workflows',
    handlers: {
      POST: async ({ request }) => governanceWorkflowHandler(request),
    },
  },
  {
    path: '/iam/governance/compliance/export',
    handlers: {
      GET: async ({ request }) => governanceComplianceExportHandler(request),
    },
  },
];
