import { logger } from './shared.js';
import type { CreateUserActorInfo } from './user-create-invitation.js';
import { maskEmail } from './user-mapping.js';

type MainserverProvisioningLogError = Error & {
  code: string;
  outcomeUnknown: boolean;
  retryable: boolean;
  statusCode: number;
};

type MainserverProvisioningFailurePhase =
  | 'configuration'
  | 'credentials'
  | 'token'
  | 'provisioning'
  | 'unknown';

const SAFE_MAINSERVER_ERROR_CODES = new Set([
  'invalid_credentials',
  'invalid_response',
  'identity_provider_unavailable',
  'mainserver_user_provisioning_config_incomplete',
  'mainserver_user_provisioning_failed',
  'missing_credentials',
  'network_error',
  'organization_mainserver_credentials_missing',
  'secret_unavailable',
  'token_request_failed',
  'unauthorized',
  'upstream_timeout',
]);

const isMainserverProvisioningError = (error: unknown): error is MainserverProvisioningLogError =>
  (() => {
    if (!(error instanceof Error) || error.name !== 'MainserverUserProvisioningError') {
      return false;
    }

    const candidate = error as Partial<MainserverProvisioningLogError>;
    return (
      typeof candidate.code === 'string' &&
      typeof candidate.statusCode === 'number' &&
      typeof candidate.retryable === 'boolean' &&
      typeof candidate.outcomeUnknown === 'boolean'
    );
  })();

const resolveFailurePhase = (
  error: MainserverProvisioningLogError
): MainserverProvisioningFailurePhase => {
  if (error.code === 'mainserver_user_provisioning_config_incomplete') {
    return 'configuration';
  }
  if (
    error.code === 'missing_credentials' ||
    error.code === 'organization_mainserver_credentials_missing' ||
    error.code === 'secret_unavailable' ||
    error.code === 'identity_provider_unavailable' ||
    error.code === 'invalid_credentials'
  ) {
    return 'credentials';
  }
  if (error.code === 'unauthorized' || error.code === 'token_request_failed') {
    return 'token';
  }
  if (
    !error.outcomeUnknown &&
    (error.code === 'network_error' || error.code === 'upstream_timeout')
  ) {
    return 'token';
  }
  if (error.outcomeUnknown || error.statusCode === 403 || error.statusCode === 422) {
    return 'provisioning';
  }
  return 'unknown';
};

const resolveSafeErrorCode = (error: MainserverProvisioningLogError): string => {
  if (error.code === 'token_request_failed' || error.code === 'unauthorized') {
    return error.code;
  }
  if (error.statusCode === 403) {
    return 'mainserver_tenant_forbidden';
  }
  if (error.statusCode === 422) {
    return 'mainserver_request_rejected';
  }
  if (SAFE_MAINSERVER_ERROR_CODES.has(error.code)) {
    return error.code;
  }
  return 'mainserver_user_provisioning_failed';
};

export const logMainserverProvisioningFailure = (input: {
  actor: CreateUserActorInfo;
  email: string;
  keycloakSubject: string;
  error: unknown;
}) => {
  const mainserverError = isMainserverProvisioningError(input.error) ? input.error : null;
  const safeErrorCode = mainserverError
    ? resolveSafeErrorCode(mainserverError)
    : 'mainserver_user_provisioning_failed';
  logger.error('IAM user mainserver provisioning failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'create_user_mainserver_provisioning',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      actor_account_id: input.actor.actorAccountId,
      keycloak_subject: input.keycloakSubject,
      email_masked: maskEmail(input.email),
      error: safeErrorCode,
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      ...(mainserverError
        ? {
            mainserver_error_code: safeErrorCode,
            mainserver_failure_phase: resolveFailurePhase(mainserverError),
            mainserver_status_code: mainserverError.statusCode,
            mainserver_retryable: mainserverError.retryable,
            mainserver_outcome_unknown: mainserverError.outcomeUnknown,
          }
        : {}),
    },
  });
};
