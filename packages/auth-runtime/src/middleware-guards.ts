import { createSdkLogger } from '@sva/server-runtime';

import { createApiError } from './api-error.js';
import { buildLogContext } from './log-context.js';
import { SessionStoreUnavailableError, SessionUserHydrationError } from './runtime-errors.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const PROFILE_DIAGNOSTIC_PATHS = new Set(['/auth/me', '/api/v1/iam/users/me/profile']);

const isProfileDiagnosticsEnabled = (): boolean => process.env.IAM_DEBUG_PROFILE_ERRORS === 'true';

const shouldLogProfileDiagnostics = (request: Request): boolean => {
  if (!isProfileDiagnosticsEnabled()) {
    return false;
  }

  return PROFILE_DIAGNOSTIC_PATHS.has(new URL(request.url).pathname);
};

export const logProfileDiagnosticsIfEnabled = (request: Request, user: SessionUser): void => {
  if (!shouldLogProfileDiagnostics(request)) {
    return;
  }

  logger.info('Auth middleware resolved session user for self-service diagnostics', {
    endpoint: request.url,
    operation: 'auth_middleware',
    auth_state: 'authenticated',
    user_id: user.id,
    session_id_present: true,
    session_instance_id: user.instanceId ?? null,
    session_roles: user.roles,
    session_roles_count: user.roles.length,
    ...buildLogContext(user.instanceId, { includeTraceId: true }),
  });
};

export const logComplianceDiagnosticsIfEnabled = (request: Request, user: SessionUser): void => {
  if (!shouldLogProfileDiagnostics(request)) {
    return;
  }

  logger.info('Auth middleware enforcing legal text compliance for self-service request', {
    endpoint: request.url,
    operation: 'auth_middleware',
    user_id: user.id,
    session_instance_id: user.instanceId,
    ...buildLogContext(user.instanceId, { includeTraceId: true }),
  });
};

export const ensureAccountLifecycleAllowsAccess = async (
  request: Request,
  user: SessionUser,
  options?: { isLocalDevelopmentAuth?: boolean }
): Promise<Response | null> => {
  void request;
  void user;
  void options;
  return null;
};

export const logUnexpectedMiddlewareError = (request: Request, error: unknown): Response => {
  const logContext = buildLogContext(undefined, { includeTraceId: true });
  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth middleware dependency failed', {
      endpoint: request.url,
      operation: 'auth_middleware',
      dependency: 'redis',
      dependency_operation: error.operation,
      error_type: error.name,
      error_message: error.message,
      ...logContext,
    });

    return createApiError(
      503,
      'internal_error',
      'Authentifizierung ist momentan nicht verfügbar, weil der Sitzungsspeicher nicht erreichbar ist.',
      logContext.request_id,
      {
        dependency: 'redis',
        reason_code: 'session_store_unavailable',
      }
    );
  }

  if (error instanceof SessionUserHydrationError) {
    logger.warn(
      'Auth middleware rejected request because the session user is missing required tenant context',
      {
        endpoint: request.url,
        operation: 'auth_middleware',
        reason_code: 'missing_session_instance_id',
        request_host: error.requestHost,
        ...logContext,
      }
    );

    return createApiError(
      401,
      'unauthorized',
      'Die Sitzung enthält keinen gültigen Instanzkontext.',
      logContext.request_id,
      {
        reason_code: 'missing_session_instance_id',
        request_host: error.requestHost,
      }
    );
  }

  logger.error('Auth middleware failed unexpectedly', {
    endpoint: request.url,
    operation: 'auth_middleware',
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...logContext,
  });

  return createApiError(500, 'internal_error', 'Authentifizierungsfehler.', logContext.request_id, {
    reason_code: 'auth_resolution_failed',
  });
};

export const logProtectedHandlerError = (request: Request, error: unknown): Response => {
  const logContext = buildLogContext(undefined, { includeTraceId: true });

  logger.error('Authenticated handler failed unexpectedly', {
    endpoint: request.url,
    operation: 'auth_middleware',
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...logContext,
  });

  return createApiError(500, 'internal_error', 'Interner Verarbeitungsfehler.', logContext.request_id, {
    reason_code: 'authenticated_handler_failed',
  });
};
