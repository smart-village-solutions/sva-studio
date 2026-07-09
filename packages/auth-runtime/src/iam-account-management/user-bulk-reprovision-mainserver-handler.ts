import {
  createBulkReprovisionMainserverHandlerInternal,
  type BulkReprovisionMainserverResult,
} from '@sva/iam-admin';

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

const mapMainserverProvisioningErrorToFailure = (
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
  readonly message: string;
} => {
  switch (error.code) {
    case 'database_unavailable':
      return { code: 'database_unavailable', message: error.message };
    case 'mainserver_user_provisioning_config_incomplete':
      return { code: 'mainserver_configuration_incomplete', message: error.message };
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return { code: 'mainserver_credentials_missing', message: error.message };
    case 'identity_provider_unavailable':
      return { code: 'mainserver_credentials_unavailable', message: error.message };
    case 'unauthorized':
      return { code: 'mainserver_credentials_invalid', message: error.message };
    case 'local_user_conflict':
      return { code: 'mainserver_user_conflict', message: error.message };
    default:
      return { code: 'mainserver_provisioning_failed', message: error.message };
  }
};

const executeBulkReprovisionMainserver = async (input: {
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
}): Promise<BulkReprovisionMainserverResult> =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const identityProvider = input.identityProvider.provider as {
      getUserAttributes: (keycloakSubject: string) => Promise<Record<string, readonly string[]>>;
      updateUser: (
        keycloakSubject: string,
        payload: { attributes: Record<string, readonly string[]> }
      ) => Promise<void>;
    };
    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const successes: { id: string }[] = [];
    const failures: { id: string; code: string; message: string }[] = [];

    for (const userId of input.userIds) {
      const detail = await resolveUserDetail(client, {
        instanceId: input.actor.instanceId,
        userId,
      });
      if (!detail) {
        failures.push({ id: userId, code: 'not_found', message: 'Nutzer nicht gefunden.' });
        continue;
      }

      const targetAccess = ensureActorCanManageTarget({
        actorMaxRoleLevel,
        actorRoles: input.ctx.user.roles,
        targetRoles: detail.roles,
      });
      if (!targetAccess.ok) {
        failures.push({ id: detail.id, code: 'forbidden', message: targetAccess.message });
        continue;
      }

      if (!detail.email) {
        failures.push({
          id: detail.id,
          code: 'conflict',
          message: 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.',
        });
        continue;
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
          failures.push({
            id: detail.id,
            code: 'conflict',
            message: 'Die Mainserver-Integration ist nicht konfiguriert oder deaktiviert.',
          });
          continue;
        }

        const existingAttributes = await trackKeycloakCall('get_user_attributes', () =>
          identityProvider.getUserAttributes(detail.keycloakSubject)
        );
        const nextAttributes = buildMainserverIdentityAttributes({
          existingAttributes,
          mainserverUserApplicationId: credentials.mainserverUserApplicationId,
          mainserverUserApplicationSecret: credentials.mainserverUserApplicationSecret,
        });

        await trackKeycloakCall('update_user', () =>
          identityProvider.updateUser(detail.keycloakSubject, {
            attributes: nextAttributes,
          })
        );
        await emitActivityLog(client, {
          instanceId: input.actor.instanceId,
          accountId: input.actor.actorAccountId,
          subjectId: detail.id,
          eventType: 'user.mainserver_credentials_reprovisioned',
          result: 'success',
          payload: {
            title: 'Mainserver-Credentials aktualisiert',
            description: 'Für dieses Konto wurden Mainserver-Credentials neu provisioniert.',
            operation: 'reprovision_mainserver_user',
            keycloak_subject: detail.keycloakSubject,
          },
          requestId: input.actor.requestId,
          traceId: input.actor.traceId,
        });
        successes.push({ id: detail.id });
      } catch (error) {
        if (error instanceof Error && error.name === 'MainserverUserProvisioningError') {
          const mappedError = mapMainserverProvisioningErrorToFailure(error as MainserverUserProvisioningError);
          failures.push({ id: detail.id, code: mappedError.code, message: mappedError.message });
          continue;
        }

        failures.push({
          id: detail.id,
          code: 'internal_error',
          message: 'Mainserver-Daten konnten nicht aktualisiert werden.',
        });
      }
    }

    await emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'user.bulk_mainserver_reprovisioned',
      result: failures.length > 0 ? 'failure' : 'success',
      payload: {
        operation: 'bulk_reprovision_mainserver_user',
        success_count: successes.length,
        failure_count: failures.length,
        failure_codes: Array.from(new Set(failures.map((failure) => failure.code))),
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
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
