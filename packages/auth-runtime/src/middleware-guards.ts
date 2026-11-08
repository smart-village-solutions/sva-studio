import { createSdkLogger, toSafeLogPath } from '@sva/server-runtime';

import { createApiError } from './api-error.js';
import { buildLogContext } from './log-context.js';
import { SessionStoreUnavailableError, SessionUserHydrationError } from './runtime-errors.js';
import type { SessionUser } from './types.js';
import { resolvePool, withResolvedInstanceDb } from './db.js';
import { getSessionControlState } from './redis-session.js';

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
    endpoint: toSafeLogPath(request.url),
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
    endpoint: toSafeLogPath(request.url),
    operation: 'auth_middleware',
    user_id: user.id,
    session_instance_id: user.instanceId,
    ...buildLogContext(user.instanceId, { includeTraceId: true }),
  });
};

export const ensureAccountLifecycleAllowsAccess = async (
  _request: Request,
  user: SessionUser,
  options?: { isLocalDevelopmentAuth?: boolean; requireCurrentAccount?: boolean }
): Promise<Response | null> => {
  // Browser/JIT/DSR contracts remain session-driven. Personal tokens need a fresh account read.
  if (!options?.requireCurrentAccount || options.isLocalDevelopmentAuth) return null;
  const requestId = buildLogContext(user.instanceId, { includeTraceId: true }).request_id;
  const denied = () =>
    createApiError(403, 'forbidden', 'Anmeldung erforderlich.', requestId, {
      reason_code: 'personal_api_account_blocked',
    });
  try {
    if ((await getSessionControlState(user.id))?.loginBlocked) return denied();
    if (!user.instanceId) {
      const { resolveIdentityProvider } =
        await import('./iam-account-management/shared-runtime.js');
      const provider = resolveIdentityProvider()?.provider;
      if (!provider?.getUserStatus) throw new Error('identity_provider_status_unavailable');
      return (await provider.getUserStatus(user.id)) === true ? null : denied();
    }
    const allowed = await withResolvedInstanceDb(resolvePool, user.instanceId, async (client) => {
      const result = await client.query<{ account_allowed: boolean }>(
        `
SELECT EXISTS (
  SELECT 1 FROM iam.accounts a
  JOIN iam.instance_memberships im ON im.account_id = a.id AND im.instance_id = $1
  WHERE a.keycloak_subject = $2 AND a.instance_id = $1
    AND a.status = 'active' AND a.is_blocked = false
    AND a.soft_deleted_at IS NULL AND a.permanently_deleted_at IS NULL
    AND a.deletion_lifecycle_state = 'active' AND a.deactivated_at IS NULL
    AND a.processing_restricted_at IS NULL
) AS account_allowed`,
        [user.instanceId, user.id]
      );
      return result.rows[0]?.account_allowed === true;
    });
    return allowed ? null : denied();
  } catch (error) {
    logger.warn('Personal API account state could not be verified', {
      operation: 'personal_api_account_check',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      request_id: requestId,
    });
    return createApiError(503, 'internal_error', 'Authentifizierungsfehler.', requestId, {
      reason_code: 'personal_api_account_check_unavailable',
    });
  }
};

export const logUnexpectedMiddlewareError = (request: Request, error: unknown): Response => {
  const logContext = buildLogContext(undefined, { includeTraceId: true });
  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth middleware dependency failed', {
      endpoint: toSafeLogPath(request.url),
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
        endpoint: toSafeLogPath(request.url),
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
    endpoint: toSafeLogPath(request.url),
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
    endpoint: toSafeLogPath(request.url),
    operation: 'auth_middleware',
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...logContext,
  });

  return createApiError(
    500,
    'internal_error',
    'Interner Verarbeitungsfehler.',
    logContext.request_id,
    {
      reason_code: 'authenticated_handler_failed',
    }
  );
};
