import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

import { createApiError } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { buildProfileDiagnosticDetails } from './profile-request-context.js';
import { iamUserOperationsCounter, logger, withInstanceScopedDb } from './shared.js';
import { runCriticalIamSchemaGuard } from './schema-guard.js';
import type { ActorInfo } from './types.js';
import type { ProfileUpdateAttemptState } from './profile-update-flow.js';

const isKeycloakRequestError = (error: unknown): error is KeycloakAdminRequestError =>
  error instanceof KeycloakAdminRequestError ||
  (error instanceof Error &&
    error.name === 'KeycloakAdminRequestError' &&
    'statusCode' in error &&
    'code' in error &&
    'retryable' in error);

const isKeycloakUnavailableError = (error: unknown): error is KeycloakAdminUnavailableError =>
  error instanceof KeycloakAdminUnavailableError ||
  (error instanceof Error &&
    error.name === 'KeycloakAdminUnavailableError' &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 503);

const buildKeycloakProfileUpdateErrorResponse = (
  actor: ActorInfo,
  error: KeycloakAdminRequestError
): Response | undefined => {
  if (error.statusCode === 400) {
    return createApiError(
      400,
      'invalid_request',
      'Profildaten wurden von Keycloak abgelehnt.',
      actor.requestId,
      {
        dependency: 'keycloak',
        reason_code: 'keycloak_validation_failed',
        keycloak_error_code: error.code,
        keycloak_status_code: error.statusCode,
      }
    );
  }

  if (error.statusCode === 409) {
    return createApiError(
      409,
      'conflict',
      'Profil konnte wegen eines Konflikts nicht mit Keycloak synchronisiert werden.',
      actor.requestId,
      {
        dependency: 'keycloak',
        reason_code: 'keycloak_conflict',
        keycloak_error_code: error.code,
        keycloak_status_code: error.statusCode,
      }
    );
  }

  return undefined;
};

export const handleProfileUpdateError = (
  actor: ActorInfo,
  error: unknown,
  attemptState?: ProfileUpdateAttemptState
): Response => {
  logger.error('IAM profile update failed', {
    operation: 'update_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error: error instanceof Error ? error.message : String(error),
    ...(isKeycloakRequestError(error)
      ? {
          keycloak_error_code: error.code,
          keycloak_status_code: error.statusCode,
          keycloak_retryable: error.retryable,
        }
      : {}),
    ...(attemptState ?? {}),
  });

  if (isKeycloakRequestError(error)) {
    const mappedKeycloakError = buildKeycloakProfileUpdateErrorResponse(actor, error);
    if (mappedKeycloakError) {
      return mappedKeycloakError;
    }
  }

  if (isKeycloakRequestError(error) || isKeycloakUnavailableError(error)) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Profil konnte nicht mit Keycloak synchronisiert werden.',
      actor.requestId
    );
  }
  const classified = classifyIamDiagnosticError(
    error,
    'Profil konnte nicht aktualisiert werden.',
    actor.requestId
  );
  if (classified.details.reason_code === 'pii_encryption_missing') {
    return createApiError(
      classified.status,
      classified.code,
      'PII-Verschlüsselung ist nicht konfiguriert.',
      actor.requestId,
      classified.details
    );
  }

  iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'failure' });
  return createApiError(
    classified.status,
    classified.code,
    classified.message,
    actor.requestId,
    classified.details
  );
};

const buildSchemaDriftFallbackResponse = async (
  actor: ActorInfo,
  fallbackMessage: string
): Promise<Response | undefined> => {
  try {
    const schemaGuard = await withInstanceScopedDb(actor.instanceId, (client) =>
      runCriticalIamSchemaGuard(client)
    );
    const failed = schemaGuard.checks.find((check) => !check.ok);
    if (!failed) {
      return undefined;
    }

    return createApiError(503, 'database_unavailable', fallbackMessage, actor.requestId, {
      dependency: 'database',
      expected_migration: failed.expectedMigration,
      instance_id: actor.instanceId,
      reason_code: 'schema_drift',
      schema_object: failed.schemaObject,
    });
  } catch {
    return undefined;
  }
};

export const handleProfileFetchError = async (
  actor: ActorInfo,
  ctx: AuthenticatedRequestContext,
  error: unknown
): Promise<Response> => {
  const classified = classifyIamDiagnosticError(
    error,
    'Profil konnte nicht geladen werden.',
    actor.requestId
  );
  const errorCause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined;
  if (classified.details.reason_code === 'unexpected_internal_error') {
    const schemaDriftResponse = await buildSchemaDriftFallbackResponse(
      actor,
      'Profil konnte nicht geladen werden.'
    );
    if (schemaDriftResponse) {
      return schemaDriftResponse;
    }
  }

  logger.error('IAM profile fetch failed', {
    operation: 'get_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
    error_cause:
      errorCause instanceof Error
        ? errorCause.message
        : errorCause !== undefined
          ? String(errorCause)
          : undefined,
    classified_status: classified.status,
    classified_code: classified.code,
    classified_reason_code: classified.details.reason_code,
  });
  iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'failure' });
  const debugDetails =
    process.env.IAM_DEBUG_PROFILE_ERRORS === 'true'
      ? {
          ...buildProfileDiagnosticDetails(ctx, 'load_profile_detail', actor),
          debug_error_type: error instanceof Error ? error.constructor.name : typeof error,
          debug_error_message: error instanceof Error ? error.message : String(error),
          debug_error_stack: error instanceof Error ? error.stack : undefined,
          debug_error_cause:
            errorCause instanceof Error
              ? errorCause.message
              : errorCause !== undefined
                ? String(errorCause)
                : undefined,
        }
      : undefined;
  return createApiError(
    classified.status,
    classified.code,
    classified.message,
    actor.requestId,
    debugDetails ? { ...classified.details, ...debugDetails } : classified.details
  );
};
