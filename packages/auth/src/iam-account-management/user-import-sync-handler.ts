import type { IamUserImportSyncReport } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { IdentityListedUser } from '../identity-provider-port';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client';
import type { AuthenticatedRequestContext } from '../middleware.server';
import type { QueryClient } from '../shared/db-helpers';
import { jsonResponse } from '../shared/db-helpers';

import { ADMIN_ROLES } from './constants';
import { asApiItem, createApiError } from './api-helpers';
import { validateCsrf } from './csrf';
import { protectField } from './encryption';
import { ensureFeature, getFeatureFlags } from './feature-flags';
import { consumeRateLimit } from './rate-limit';
import {
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProvider,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared';

const KEYCLOAK_PAGE_SIZE = 100;

const readSingleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const matchesInstanceId = (user: IdentityListedUser, instanceId: string): boolean =>
  user.attributes?.instanceId?.includes(instanceId) ?? false;

const resolveDisplayName = (user: IdentityListedUser): string => {
  const explicitDisplayName = readSingleAttribute(user.attributes, 'displayName');
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [user.firstName, user.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || user.username || user.email || user.externalId;
};

const protectOptionalField = (value: string | undefined, context: string): string | null =>
  value ? protectField(value, context) : null;

const UPSERT_ACCOUNT_QUERY = `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  username_ciphertext,
  email_ciphertext,
  display_name_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext,
  status
)
VALUES (
  $1::uuid,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8
)
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE
SET
  username_ciphertext = EXCLUDED.username_ciphertext,
  email_ciphertext = EXCLUDED.email_ciphertext,
  display_name_ciphertext = EXCLUDED.display_name_ciphertext,
  first_name_ciphertext = EXCLUDED.first_name_ciphertext,
  last_name_ciphertext = EXCLUDED.last_name_ciphertext,
  status = EXCLUDED.status,
  updated_at = NOW()
RETURNING id, (xmax = 0) AS created;
`;

const INSERT_MEMBERSHIP_QUERY = `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1::uuid, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`;

const upsertIdentityUser = async (
  client: QueryClient,
  input: { instanceId: string; user: IdentityListedUser }
): Promise<{ accountId: string; created: boolean }> => {
  const status = input.user.enabled === false ? 'inactive' : 'active';
  const displayName = resolveDisplayName(input.user);
  const upsert = await client.query<{ id: string; created: boolean }>(UPSERT_ACCOUNT_QUERY, [
    input.instanceId,
    input.user.externalId,
    protectOptionalField(input.user.username, `iam.accounts.username:${input.user.externalId}`),
    protectOptionalField(input.user.email, `iam.accounts.email:${input.user.externalId}`),
    protectField(displayName, `iam.accounts.display_name:${input.user.externalId}`),
    protectOptionalField(input.user.firstName, `iam.accounts.first_name:${input.user.externalId}`),
    protectOptionalField(input.user.lastName, `iam.accounts.last_name:${input.user.externalId}`),
    status,
  ]);

  const accountId = upsert.rows[0]?.id;
  if (!accountId) {
    throw new Error('keycloak_import_upsert_failed');
  }

  await client.query(INSERT_MEMBERSHIP_QUERY, [input.instanceId, accountId]);
  return {
    accountId,
    created: Boolean(upsert.rows[0]?.created),
  };
};

const listAllKeycloakUsers = async (): Promise<readonly IdentityListedUser[]> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new KeycloakAdminUnavailableError('Keycloak Admin API ist nicht konfiguriert.');
  }

  const users: IdentityListedUser[] = [];
  for (let first = 0; ; first += KEYCLOAK_PAGE_SIZE) {
    const page = await trackKeycloakCall('list_users_for_import', () =>
      identityProvider.provider.listUsers({
        first,
        max: KEYCLOAK_PAGE_SIZE,
      })
    );
    users.push(...page);
    if (page.length < KEYCLOAK_PAGE_SIZE) {
      return users;
    }
  }
};

export const syncUsersFromKeycloakInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const listedUsers = await listAllKeycloakUsers();
    const matchingUsers = listedUsers.filter((user) => matchesInstanceId(user, actorResolution.actor.instanceId));

    const report = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      let importedCount = 0;
      let updatedCount = 0;

      for (const user of matchingUsers) {
        const result = await upsertIdentityUser(client, {
          instanceId: actorResolution.actor.instanceId,
          user,
        });
        if (result.created) {
          importedCount += 1;
        } else {
          updatedCount += 1;
        }
      }

      const summary: IamUserImportSyncReport = {
        importedCount,
        updatedCount,
        skippedCount: listedUsers.length - matchingUsers.length,
        totalKeycloakUsers: listedUsers.length,
      };

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: actorResolution.actor.actorAccountId,
        eventType: 'user.keycloak_import_synced',
        result: 'success',
        payload: {
          imported_count: summary.importedCount,
          updated_count: summary.updatedCount,
          skipped_count: summary.skippedCount,
          total_keycloak_users: summary.totalKeycloakUsers,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return summary;
    });

    iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'success' });
    return jsonResponse(200, asApiItem(report, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
      iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
      return createApiError(
        503,
        'keycloak_unavailable',
        'Keycloak-Benutzer konnten nicht geladen werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorMessage.startsWith('pii_encryption_required:')) {
      iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
      return createApiError(
        503,
        'internal_error',
        'PII-Verschlüsselung ist nicht konfiguriert.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM keycloak user import failed', {
      operation: 'sync_keycloak_users',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
    return createApiError(
      503,
      'database_unavailable',
      'Keycloak-Benutzer konnten nicht in IAM synchronisiert werden.',
      actorResolution.actor.requestId
    );
  }
};
