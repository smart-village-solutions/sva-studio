import { parse as parseCookie } from 'cookie-es';
import { createSdkLogger, toJsonErrorResponse } from '@sva/sdk/server';

import { getSessionUser } from './auth.server.js';
import { getAuthConfig } from './config.js';
import { withLegalTextCompliance } from './legal-text-enforcement.server.js';
import { createMockSessionUser, isMockAuthEnabled } from './mock-auth.server.js';
import { buildLogContext } from './shared/log-context.js';
import type { SessionUser } from './types.js';

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

const LEGAL_TEXT_PROTECTED_PATHS = new Set(['/iam/authorize', '/iam/me/permissions']);
const LEGAL_TEXT_PROTECTED_PREFIXES = ['/api/v1/iam/'];
const LEGAL_TEXT_EXEMPT_AUTH_PATHS = new Set(['/auth/login', '/auth/callback', '/auth/logout', '/auth/me']);
const LEGAL_TEXT_EXEMPT_IAM_PREFIXES = ['/api/v1/iam/legal-texts'];
const LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES = ['/iam/me/legal-texts'];
const LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS = new Set(['accept_legal_text', 'revoke_legal_acceptance']);

const readWorkflowOperation = async (request: Request): Promise<string | undefined> => {
  try {
    const payload = await request.clone().json();
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }
    const operation = (payload as { operation?: unknown }).operation;
    return typeof operation === 'string' ? operation : undefined;
  } catch {
    return undefined;
  }
};

const shouldEnforceLegalTextCompliance = async (request: Request): Promise<boolean> => {
  const pathname = new URL(request.url).pathname;
  if (LEGAL_TEXT_EXEMPT_AUTH_PATHS.has(pathname)) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_IAM_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname === '/api/v1/iam/governance/workflows') {
    const operation = await readWorkflowOperation(request);
    return !LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS.has(operation ?? '');
  }

  if (LEGAL_TEXT_PROTECTED_PATHS.has(pathname)) {
    return true;
  }

  return LEGAL_TEXT_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

/**
 * Middleware helper that resolves an authenticated user from the current request.
 */
export const withAuthenticatedUser = async (
  request: Request,
  handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
): Promise<Response> => {
  try {
    if (isMockAuthEnabled()) {
      return await handler({ sessionId: 'mock-auth-session', user: createMockSessionUser() });
    }

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

    const runHandler = async () => handler({ sessionId, user });
    if (user.instanceId && (await shouldEnforceLegalTextCompliance(request))) {
      return await withLegalTextCompliance(user.instanceId, user.id, runHandler);
    }

    return await runHandler();
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
