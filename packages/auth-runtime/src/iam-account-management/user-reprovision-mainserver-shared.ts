import type { ApiErrorCode } from '@sva/core';

import type { IdentityProviderPort } from '../identity-provider-port.js';
import { buildMainserverIdentityAttributes } from '../mainserver-credentials.js';
import { jsonResponse } from '../db.js';

import { createApiError } from './api-helpers.js';
import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';
import type { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { emitActivityLog } from './shared-activity.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import { trackKeycloakCall, withInstanceScopedDb } from './shared.js';

export const REPROVISION_MAINSERVER_ENDPOINT = 'POST:/api/v1/iam/users/$userId/reprovision-mainserver';

export type MainserverReprovisionActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type MainserverProvisioningSuccessInput = {
  readonly actor: MainserverReprovisionActor;
  readonly actorSubject: string;
  readonly identityProvider: IdentityProviderPort;
  readonly requestId: string | undefined;
  readonly user: {
    readonly email: string;
    readonly firstName?: string;
    readonly id: string;
    readonly keycloakSubject: string;
    readonly lastName?: string;
  };
};

const createMainserverProvisioningResponse = (status: number, payload: unknown): Response =>
  jsonResponse(status, payload);

export const createTerminalReprovisionResponse = (
  requestId: string | undefined,
  status: number,
  code: ApiErrorCode,
  message: string
): Response => createApiError(status, code, message, requestId);

export const createReprovisionConflictResponse = (
  requestId: string | undefined,
  message: string
): Response => createTerminalReprovisionResponse(requestId, 409, 'conflict', message);

const mapMainserverProvisioningErrorToApiError = (
  error: MainserverUserProvisioningError
): {
  readonly code:
    | 'database_unavailable'
    | 'mainserver_configuration_incomplete'
    | 'mainserver_credentials_missing'
    | 'mainserver_credentials_unavailable'
    | 'mainserver_credentials_invalid'
    | 'mainserver_user_conflict'
    | 'mainserver_provisioning_failed';
  readonly details: Readonly<Record<string, unknown>>;
  readonly status: number;
} => {
  switch (error.code) {
    case 'database_unavailable':
      return {
        code: 'database_unavailable',
        details: { dependency: 'sva_mainserver', reason_code: 'mainserver_database_unavailable' },
        status: error.statusCode,
      };
    case 'mainserver_user_provisioning_config_incomplete':
      return {
        code: 'mainserver_configuration_incomplete',
        details: { dependency: 'sva_mainserver', reason_code: error.code },
        status: error.statusCode,
      };
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return {
        code: 'mainserver_credentials_missing',
        details: { dependency: 'sva_mainserver', reason_code: error.code },
        status: error.statusCode,
      };
    case 'identity_provider_unavailable':
      return {
        code: 'mainserver_credentials_unavailable',
        details: { dependency: 'sva_mainserver', reason_code: error.code },
        status: error.statusCode,
      };
    case 'unauthorized':
      return {
        code: 'mainserver_credentials_invalid',
        details: { dependency: 'sva_mainserver', reason_code: 'mainserver_token_unauthorized' },
        status: error.statusCode,
      };
    case 'local_user_conflict':
      return {
        code: 'mainserver_user_conflict',
        details: { dependency: 'sva_mainserver', reason_code: error.code },
        status: error.statusCode,
      };
    default:
      return {
        code: 'mainserver_provisioning_failed',
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_upstream_failure',
          upstream_error_code: error.code,
        },
        status: error.statusCode,
      };
  }
};

export const buildProvisioningErrorResponse = (requestId: string | undefined, error: unknown): Response => {
  if (error instanceof Error && error.name === 'MainserverUserProvisioningError') {
    const mappedError = mapMainserverProvisioningErrorToApiError(error as MainserverUserProvisioningError);
    return createApiError(
      Math.max(409, mappedError.status),
      mappedError.code,
      error.message,
      requestId,
      mappedError.details
    );
  }
  return createApiError(500, 'internal_error', 'Mainserver-Daten konnten nicht aktualisiert werden.', requestId);
};

export const completeReprovisionIdempotency = async (input: {
  actor: MainserverReprovisionActor;
  idempotencyKey: string;
  response: Response;
}) => {
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: REPROVISION_MAINSERVER_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: input.response.ok ? 'COMPLETED' : 'FAILED',
    responseStatus: input.response.status,
    responseBody: await input.response.clone().json(),
  });
  return input.response;
};

export const reserveReprovisionIdempotency = async (input: {
  actor: MainserverReprovisionActor;
  idempotencyKey: string;
  payloadHash: string;
  requestId: string | undefined;
}) => {
  const reserve = await reserveIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: REPROVISION_MAINSERVER_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
  });
  if (reserve.status === 'replay') {
    return { kind: 'response', response: jsonResponse(reserve.responseStatus, reserve.responseBody) } as const;
  }
  if (reserve.status === 'conflict') {
    return {
      kind: 'response',
      response: createTerminalReprovisionResponse(input.requestId, 409, 'idempotency_key_reuse', reserve.message),
    } as const;
  }
  return { kind: 'reserved' } as const;
};

const persistMainserverCredentials = async (input: {
  credentials: {
    mainserverUserApplicationId: string;
    mainserverUserApplicationSecret: string;
  };
  identityProvider: IdentityProviderPort;
  keycloakSubject: string;
}) => {
  const existingAttributes = await trackKeycloakCall('get_user_attributes', () =>
    input.identityProvider.getUserAttributes(input.keycloakSubject)
  );
  const nextAttributes = buildMainserverIdentityAttributes({
    existingAttributes,
    mainserverUserApplicationId: input.credentials.mainserverUserApplicationId,
    mainserverUserApplicationSecret: input.credentials.mainserverUserApplicationSecret,
  });
  await trackKeycloakCall('update_user', () =>
    input.identityProvider.updateUser(input.keycloakSubject, { attributes: nextAttributes })
  );
};

const emitMainserverReprovisionAudit = async (input: {
  actor: MainserverReprovisionActor;
  user: {
    id: string;
    keycloakSubject: string;
  };
}) =>
  withInstanceScopedDb(input.actor.instanceId, (client) =>
    emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      subjectId: input.user.id,
      eventType: 'user.mainserver_credentials_reprovisioned',
      result: 'success',
      payload: {
        title: 'Mainserver-Credentials aktualisiert',
        description: 'Für dieses Konto wurden Mainserver-Credentials neu provisioniert.',
        operation: 'reprovision_mainserver_user',
        keycloak_subject: input.user.keycloakSubject,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    })
  );

export const reprovisionMainserverCredentials = async (input: MainserverProvisioningSuccessInput) => {
  const credentials = await provisionMainserverUserCredentials({
    actor: input.actor,
    actorSubject: input.actorSubject,
    keycloakSubject: input.user.keycloakSubject,
    payload: {
      email: input.user.email,
      groupIds: [],
      firstName: input.user.firstName,
      lastName: input.user.lastName,
      roleIds: [],
    },
  });
  if (!credentials) {
    return {
      kind: 'conflict',
      response: createReprovisionConflictResponse(
        input.requestId,
        'Die Mainserver-Integration ist nicht konfiguriert oder deaktiviert.'
      ),
    } as const;
  }
  await persistMainserverCredentials({
    credentials,
    identityProvider: input.identityProvider,
    keycloakSubject: input.user.keycloakSubject,
  });
  await emitMainserverReprovisionAudit({
    actor: input.actor,
    user: { id: input.user.id, keycloakSubject: input.user.keycloakSubject },
  });
  return {
    kind: 'success',
    response: createMainserverProvisioningResponse(200, {
      data: { status: 'updated' },
      requestId: input.requestId,
    }),
  } as const;
};
