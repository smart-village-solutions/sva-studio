import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import { jsonResponse } from '../db.js';

import { createApiError } from './api-helpers.js';
import { emitActivityLog } from './shared-activity.js';
import {
  completeIdempotency,
  iamUserOperationsCounter,
  logger,
  withInstanceScopedDb,
} from './shared.js';

export type PasswordSetupEmailActor = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
};

export type SendPasswordSetupEmailDependencies = {
  actor: PasswordSetupEmailActor;
  endpoint: string;
  idempotencyKey: string;
};

export type ExecuteActionsEmail = (
  userId: string,
  input: {
    actions: readonly string[];
    clientId?: string;
    lifespan?: number;
    redirectUri?: string;
  }
) => Promise<void>;

export const buildKeycloakUnavailableResponse = (requestId?: string): Response =>
  createApiError(
    503,
    'keycloak_unavailable',
    'Einladungs-E-Mail zum Passwort setzen konnte nicht an Keycloak übergeben werden.',
    requestId
  );

export const buildRequestResponseBody = <T>(data: T, requestId?: string) => ({
  data,
  ...(requestId ? { requestId } : {}),
});

export const buildErrorResponseBody = (input: {
  code: string;
  message: string;
  requestId?: string;
}) => ({
  error: {
    code: input.code,
    message: input.message,
  },
  ...(input.requestId ? { requestId: input.requestId } : {}),
});

export const finalizePasswordSetupEmailResponse = async (
  input: SendPasswordSetupEmailDependencies & {
    status: 'COMPLETED' | 'FAILED';
    responseStatus: number;
    responseBody: unknown;
    result: 'success' | 'failure';
  }
) => {
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
  iamUserOperationsCounter.add(1, { action: 'send_password_setup_email', result: input.result });
  return jsonResponse(input.responseStatus, input.responseBody);
};

export const finalizePasswordSetupEmailError = async (
  input: SendPasswordSetupEmailDependencies & {
    responseStatus: number;
    responseBody: unknown;
  }
) =>
  finalizePasswordSetupEmailResponse({
    ...input,
    status: 'FAILED',
    result: 'failure',
  });

export const emitPasswordSetupEmailFailureAudit = async (input: {
  actor: PasswordSetupEmailActor;
  userId: string;
  error: unknown;
}) => {
  try {
    await withInstanceScopedDb(input.actor.instanceId, (client) =>
      emitActivityLog(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        eventType: 'user.password_setup_email_failed',
        result: 'failure',
        payload: {
          operation: 'send_password_setup_email',
          user_id: input.userId,
          error: input.error instanceof Error ? input.error.message : String(input.error),
        },
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      })
    );
  } catch (activityError) {
    logger.warn('IAM user password setup email failure audit write failed', {
      workspace_id: input.actor.instanceId,
      context: {
        operation: 'send_password_setup_email_audit_failure',
        request_id: input.actor.requestId,
        trace_id: input.actor.traceId,
        error: activityError instanceof Error ? activityError.message : String(activityError),
      },
    });
  }
};

export const buildPasswordSetupEmailFailureResponse = (error: unknown, requestId?: string) =>
  error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError
    ? buildKeycloakUnavailableResponse(requestId)
    : createApiError(
        500,
        'internal_error',
        'Einladungs-E-Mail zum Passwort setzen konnte nicht gesendet werden.',
        requestId
      );

export const logSendPasswordSetupEmailFailure = (input: {
  actor: PasswordSetupEmailActor;
  error: unknown;
}) => {
  logger.error('IAM user password setup email resend failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'send_password_setup_email',
      instance_id: input.actor.instanceId,
      actor_account_id: input.actor.actorAccountId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
};
