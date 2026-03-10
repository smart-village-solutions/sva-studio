import { parse as parseCookie } from 'cookie-es';
import { createSdkLogger, toJsonErrorResponse } from '@sva/sdk/server';

import { getSessionUser } from './auth.server';
import { getAuthConfig } from './config';
import { buildLogContext } from './shared/log-context';
import type { SessionUser } from './types';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export type AuthenticatedRequestContext = {
  sessionId: string;
  user: SessionUser;
};

const readSessionId = (request: Request) => {
  const { sessionCookieName } = getAuthConfig();
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[sessionCookieName];
};

const unauthorized = () =>
  new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Middleware helper that resolves an authenticated user from the current request.
 */
export const withAuthenticatedUser = async (
  request: Request,
  handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
): Promise<Response> => {
  try {
    const sessionId = readSessionId(request);
    if (!sessionId) {
      logger.debug('Auth middleware rejected request without session cookie', {
        endpoint: request.url,
        auth_state: 'unauthenticated',
        operation: 'auth_middleware',
        ...buildLogContext(undefined, { includeTraceId: true }),
      });
      return unauthorized();
    }

    const user = await getSessionUser(sessionId);
    if (!user) {
      logger.warn('Auth middleware rejected request with invalid session', {
        endpoint: request.url,
        auth_state: 'invalid_session',
        session_exists: true,
        user_exists: false,
        operation: 'auth_middleware',
        ...buildLogContext(undefined, { includeTraceId: true }),
      });
      return unauthorized();
    }

    return await handler({ sessionId, user });
  } catch (error) {
    const logContext = buildLogContext(undefined, { includeTraceId: true });
    logger.error('Auth middleware failed unexpectedly', {
      endpoint: request.url,
      operation: 'auth_middleware',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
      ...logContext,
    });

    return toJsonErrorResponse(500, 'internal_error', 'Authentifizierungsfehler.', {
      requestId: logContext.request_id,
    });
  }
};
