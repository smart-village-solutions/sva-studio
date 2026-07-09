import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { buildMainserverIdentityAttributes } from '../mainserver-credentials.js';
import { jsonResponse } from '../db.js';

import { createApiError } from './api-helpers.js';
import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';
import type { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { ensureActorCanManageTarget, resolveActorMaxRoleLevel } from './shared-actor-authorization.js';
import { emitActivityLog } from './shared-activity.js';
import { trackKeycloakCall, withInstanceScopedDb } from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';
import { resolveUserMutationTargetContext } from './user-mutation-request-context.shared.js';

const createMainserverProvisioningResponse = (status: number, payload: unknown): Response =>
  jsonResponse(status, payload);

type MainserverReprovisionActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

const resolveTargetUser = async (input: {
  actor: MainserverReprovisionActor;
  ctx: AuthenticatedRequestContext;
  userId: string;
}) =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const detail = await resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
    if (!detail) {
      return { kind: 'not_found' } as const;
    }

    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const targetAccess = ensureActorCanManageTarget({
      actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: detail.roles,
    });
    if (!targetAccess.ok) {
      return { kind: 'forbidden', failure: targetAccess } as const;
    }

    return { kind: 'ok', user: detail } as const;
  });

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
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_database_unavailable',
        },
        status: error.statusCode,
      };
    case 'mainserver_user_provisioning_config_incomplete':
      return {
        code: 'mainserver_configuration_incomplete',
        details: {
          dependency: 'sva_mainserver',
          reason_code: error.code,
        },
        status: error.statusCode,
      };
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return {
        code: 'mainserver_credentials_missing',
        details: {
          dependency: 'sva_mainserver',
          reason_code: error.code,
        },
        status: error.statusCode,
      };
    case 'identity_provider_unavailable':
      return {
        code: 'mainserver_credentials_unavailable',
        details: {
          dependency: 'sva_mainserver',
          reason_code: error.code,
        },
        status: error.statusCode,
      };
    case 'unauthorized':
      return {
        code: 'mainserver_credentials_invalid',
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_token_unauthorized',
        },
        status: error.statusCode,
      };
    case 'local_user_conflict':
      return {
        code: 'mainserver_user_conflict',
        details: {
          dependency: 'sva_mainserver',
          reason_code: error.code,
        },
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

const buildProvisioningErrorResponse = (requestId: string | undefined, error: unknown): Response => {
  if (error instanceof Error && error.name === 'MainserverUserProvisioningError') {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 409;
    const mappedError = mapMainserverProvisioningErrorToApiError(
      error as MainserverUserProvisioningError
    );
    return createApiError(
      Math.max(statusCode, mappedError.status),
      mappedError.code,
      error.message,
      requestId,
      mappedError.details
    );
  }

  return createApiError(500, 'internal_error', 'Mainserver-Daten konnten nicht aktualisiert werden.', requestId);
};

export const reprovisionMainserverUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const targetContext = await resolveUserMutationTargetContext(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if (targetContext instanceof Response) {
    return targetContext;
  }
  const requestId = targetContext.actor.requestId ?? requestContext.requestId;

  const resolvedTarget = await resolveTargetUser({
    actor: targetContext.actor,
    ctx,
    userId: targetContext.userId,
  });
  if (resolvedTarget.kind === 'not_found') {
    return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', requestId);
  }
  if (resolvedTarget.kind === 'forbidden') {
    return createApiError(
      403,
      'forbidden',
      resolvedTarget.failure.message,
      requestId
    );
  }

  if (!resolvedTarget.user.email) {
    return createApiError(
      409,
      'conflict',
      'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.',
      requestId
    );
  }

  try {
    const credentials = await provisionMainserverUserCredentials({
      actor: targetContext.actor,
      actorSubject: ctx.user.id,
      keycloakSubject: resolvedTarget.user.keycloakSubject,
      payload: {
        email: resolvedTarget.user.email,
        groupIds: [],
        firstName: resolvedTarget.user.firstName,
        lastName: resolvedTarget.user.lastName,
        roleIds: [],
      },
    });

    if (!credentials) {
      return createApiError(
        409,
        'conflict',
        'Die Mainserver-Integration ist nicht konfiguriert oder deaktiviert.',
        requestId
      );
    }

    const existingAttributes = await trackKeycloakCall('get_user_attributes', () =>
      targetContext.identityProvider.provider.getUserAttributes(resolvedTarget.user.keycloakSubject)
    );
    const nextAttributes = buildMainserverIdentityAttributes({
      existingAttributes,
      mainserverUserApplicationId: credentials.mainserverUserApplicationId,
      mainserverUserApplicationSecret: credentials.mainserverUserApplicationSecret,
    });

    await trackKeycloakCall('update_user', () =>
      targetContext.identityProvider.provider.updateUser(resolvedTarget.user.keycloakSubject, {
        attributes: nextAttributes,
      })
    );
    await emitMainserverReprovisionAudit({
      actor: targetContext.actor,
      user: {
        id: resolvedTarget.user.id,
        keycloakSubject: resolvedTarget.user.keycloakSubject,
      },
    });

    return createMainserverProvisioningResponse(200, {
      data: { status: 'updated' },
      requestId,
    });
  } catch (error) {
    return buildProvisioningErrorResponse(requestId, error);
  }
};
