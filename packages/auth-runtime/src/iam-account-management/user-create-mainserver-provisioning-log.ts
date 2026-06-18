import { logger } from './shared.js';
import type { CreateUserActorInfo } from './user-create-invitation.js';
import { maskEmail } from './user-mapping.js';

type MainserverProvisioningLogError = Error & {
  code: string;
  retryable: boolean;
  statusCode: number;
};

const isMainserverProvisioningError = (error: unknown): error is MainserverProvisioningLogError =>
  (() => {
    if (!(error instanceof Error) || error.name !== 'MainserverUserProvisioningError') {
      return false;
    }

    const candidate = error as Partial<MainserverProvisioningLogError>;
    return (
      typeof candidate.code === 'string' &&
      typeof candidate.statusCode === 'number' &&
      typeof candidate.retryable === 'boolean'
    );
  })();

export const logMainserverProvisioningFailure = (input: {
  actor: CreateUserActorInfo;
  email: string;
  keycloakSubject: string;
  error: unknown;
}) => {
  const mainserverError = isMainserverProvisioningError(input.error) ? input.error : null;
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
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      error: input.error instanceof Error ? input.error.message : String(input.error),
      ...(mainserverError
        ? {
            mainserver_error_code: mainserverError.code,
            mainserver_status_code: mainserverError.statusCode,
            mainserver_retryable: mainserverError.retryable,
          }
        : {}),
    },
  });
};
