import {
  createBulkReprovisionMainserverHandlerInternal,
  type BulkReprovisionMainserverResult,
} from '@sva/iam-admin';

import type { QueryClient } from '../db.js';
import { buildMainserverIdentityAttributes } from '../mainserver-credentials.js';

import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';
import type { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { ensureActorCanManageTarget, resolveActorMaxRoleLevel } from './shared-actor-authorization.js';
import { emitActivityLog } from './shared-activity.js';
import { iamUserOperationsCounter, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  completeBulkReprovisionMainserverFailure,
  completeBulkReprovisionMainserverSuccess,
  resolveBulkReprovisionMainserverContext,
} from './user-bulk-reprovision-mainserver-context.js';

type BulkReprovisionInput = {
  actor: {
    instanceId: string;
    actorAccountId: string;
    requestId?: string;
    traceId?: string;
  };
  ctx: {
    user: {
      id: string;
      roles: string[];
    };
  };
  userIds: readonly string[];
  identityProvider: {
    provider: unknown;
  };
};

type BulkReprovisionIdentityProvider = {
  getUserAttributes: (keycloakSubject: string) => Promise<Record<string, readonly string[]>>;
  updateUser: (
    keycloakSubject: string,
    payload: { attributes: Record<string, readonly string[]> }
  ) => Promise<void>;
};

type BulkReprovisionFailure = { id: string; code: string; message: string };

const resolveBulkReprovisionIdentityProvider = (provider: unknown): BulkReprovisionIdentityProvider =>
  provider as BulkReprovisionIdentityProvider;

const mapMainserverProvisioningErrorToFailure = (
  error: MainserverUserProvisioningError
): BulkReprovisionFailure['code'] => {
  switch (error.code) {
    case 'database_unavailable':
      return 'database_unavailable';
    case 'mainserver_user_provisioning_config_incomplete':
      return 'mainserver_configuration_incomplete';
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return 'mainserver_credentials_missing';
    case 'identity_provider_unavailable':
      return 'mainserver_credentials_unavailable';
    case 'unauthorized':
      return 'mainserver_credentials_invalid';
    case 'local_user_conflict':
      return 'mainserver_user_conflict';
    default:
      return 'mainserver_provisioning_failed';
  }
};

const emitBulkReprovisionSuccessAudit = async (input: {
  actor: BulkReprovisionInput['actor'];
  client: QueryClient;
  detail: { id: string; keycloakSubject: string };
}) =>
  emitActivityLog(input.client, {
    instanceId: input.actor.instanceId,
    accountId: input.actor.actorAccountId,
    subjectId: input.detail.id,
    eventType: 'user.mainserver_credentials_reprovisioned',
    result: 'success',
    payload: {
      title: 'Mainserver-Credentials aktualisiert',
      description: 'Für dieses Konto wurden Mainserver-Credentials neu provisioniert.',
      operation: 'reprovision_mainserver_user',
      keycloak_subject: input.detail.keycloakSubject,
    },
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });

const syncReprovisionedMainserverCredentials = async (input: {
  credentials: {
    mainserverUserApplicationId: string;
    mainserverUserApplicationSecret: string;
  };
  detail: { keycloakSubject: string };
  identityProvider: BulkReprovisionIdentityProvider;
}) => {
  const existingAttributes = await trackKeycloakCall('get_user_attributes', () =>
    input.identityProvider.getUserAttributes(input.detail.keycloakSubject)
  );
  const nextAttributes = buildMainserverIdentityAttributes({
    existingAttributes,
    mainserverUserApplicationId: input.credentials.mainserverUserApplicationId,
    mainserverUserApplicationSecret: input.credentials.mainserverUserApplicationSecret,
  });

  await trackKeycloakCall('update_user', () =>
    input.identityProvider.updateUser(input.detail.keycloakSubject, {
      attributes: nextAttributes,
    })
  );
};

const reprovisionSingleUser = async (input: {
  actor: BulkReprovisionInput['actor'];
  actorMaxRoleLevel: number;
  client: QueryClient & Parameters<typeof resolveUserDetail>[0];
  ctx: BulkReprovisionInput['ctx'];
  identityProvider: BulkReprovisionIdentityProvider;
  userId: string;
}): Promise<{ ok: true; id: string } | { ok: false; failure: BulkReprovisionFailure }> => {
  const detail = await resolveUserDetail(input.client, {
    instanceId: input.actor.instanceId,
    userId: input.userId,
  });
  if (!detail) {
    return { ok: false, failure: { id: input.userId, code: 'not_found', message: 'Nutzer nicht gefunden.' } };
  }

  const targetAccess = ensureActorCanManageTarget({
    actorMaxRoleLevel: input.actorMaxRoleLevel,
    actorRoles: input.ctx.user.roles,
    targetRoles: detail.roles,
  });
  if (!targetAccess.ok) {
    return { ok: false, failure: { id: detail.id, code: 'forbidden', message: targetAccess.message } };
  }

  if (!detail.email) {
    return {
      ok: false,
      failure: { id: detail.id, code: 'conflict', message: 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.' },
    };
  }

  try {
    const credentials = await provisionMainserverUserCredentials({
      actor: input.actor,
      actorSubject: input.ctx.user.id,
      keycloakSubject: detail.keycloakSubject,
      payload: {
        email: detail.email,
        groupIds: [],
        firstName: detail.firstName,
        lastName: detail.lastName,
        roleIds: [],
      },
    });

    if (!credentials) {
      return {
        ok: false,
        failure: {
          id: detail.id,
          code: 'conflict',
          message: 'Die Mainserver-Integration ist nicht konfiguriert oder deaktiviert.',
        },
      };
    }

    await syncReprovisionedMainserverCredentials({
      credentials,
      detail,
      identityProvider: input.identityProvider,
    });
    await emitBulkReprovisionSuccessAudit({
      actor: input.actor,
      client: input.client,
      detail,
    });

    return { ok: true, id: detail.id };
  } catch (error) {
    if (error instanceof Error && error.name === 'MainserverUserProvisioningError') {
      return {
        ok: false,
        failure: {
          id: detail.id,
          code: mapMainserverProvisioningErrorToFailure(error as MainserverUserProvisioningError),
          message: error.message,
        },
      };
    }

    return {
      ok: false,
      failure: {
        id: detail.id,
        code: 'internal_error',
        message: 'Mainserver-Daten konnten nicht aktualisiert werden.',
      },
    };
  }
};

const emitBulkReprovisionRequestAudit = async (input: {
  actor: BulkReprovisionInput['actor'];
  client: QueryClient;
  failures: readonly BulkReprovisionFailure[];
  successes: readonly { id: string }[];
}) => {
  await emitActivityLog(input.client, {
    instanceId: input.actor.instanceId,
    accountId: input.actor.actorAccountId,
    eventType: 'user.bulk_mainserver_reprovisioned',
    result: input.failures.length > 0 ? 'failure' : 'success',
    payload: {
      operation: 'bulk_reprovision_mainserver_user',
      success_count: input.successes.length,
      failure_count: input.failures.length,
      failure_codes: Array.from(new Set(input.failures.map((failure) => failure.code))),
    },
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });
};

const executeBulkReprovisionMainserver = async (
  input: BulkReprovisionInput
): Promise<BulkReprovisionMainserverResult> =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const identityProvider = resolveBulkReprovisionIdentityProvider(input.identityProvider.provider);
    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const successes: { id: string }[] = [];
    const failures: BulkReprovisionFailure[] = [];

    for (const userId of input.userIds) {
      const result = await reprovisionSingleUser({
        actor: input.actor,
        actorMaxRoleLevel,
        client,
        ctx: input.ctx,
        identityProvider,
        userId,
      });
      if (result.ok) {
        successes.push({ id: result.id });
      } else {
        failures.push(result.failure);
      }
    }

    await emitBulkReprovisionRequestAudit({
      actor: input.actor,
      client,
      failures,
      successes,
    });

    iamUserOperationsCounter.add(1, {
      action: 'bulk_reprovision_mainserver',
      result: failures.length > 0 ? 'partial' : 'success',
    });

    return { successes, failures };
  });

export const bulkReprovisionMainserverInternal = createBulkReprovisionMainserverHandlerInternal({
  resolveBulkReprovisionMainserverContext,
  executeBulkReprovisionMainserver,
  completeBulkReprovisionMainserverSuccess,
  completeBulkReprovisionMainserverFailure,
});
