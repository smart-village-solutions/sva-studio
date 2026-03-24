import { createHash } from 'node:crypto';
import type { IamUserImportSyncReport } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { IdentityListedUser } from '../identity-provider-port.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import type { QueryClient } from '../shared/db-helpers.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { buildLogContext } from '../shared/log-context.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { protectField } from './encryption.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import type { ActorInfo } from './types.js';
import {
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProvider,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';

const KEYCLOAK_PAGE_SIZE = 100;
const SKIPPED_USER_DEBUG_LOG_CAP = 20;
const SKIPPED_USER_INSTANCE_SAMPLE_CAP = 5;

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

const toSubjectRef = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);

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
  $1,
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
VALUES ($1, $2::uuid, 'member')
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

const resolveSyncActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<{ actor: ActorInfo } | { error: Response }> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution;
  }
  if (!actorResolution.actor.actorAccountId) {
    return {
      error: createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId),
    };
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return { error: csrfError };
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  return { actor: actorResolution.actor };
};

export const collectSyncCandidates = (
  listedUsers: readonly IdentityListedUser[],
  expectedInstanceId: string
): {
  matchingUsers: IdentityListedUser[];
  skippedCount: number;
  skippedInstanceIds: ReadonlySet<string>;
} => {
  const matchingUsers: IdentityListedUser[] = [];
  const debugLoggingEnabled = logger.isLevelEnabled('debug');
  let skippedCount = 0;
  let debugLoggedCount = 0;
  const skippedInstanceIds = new Set<string>();

  for (const user of listedUsers) {
    if (matchesInstanceId(user, expectedInstanceId)) {
      matchingUsers.push(user);
      continue;
    }

    skippedCount += 1;
    const userInstanceId = readSingleAttribute(user.attributes, 'instanceId');
    if (userInstanceId && skippedInstanceIds.size < SKIPPED_USER_INSTANCE_SAMPLE_CAP) {
      skippedInstanceIds.add(userInstanceId);
    }

    if (debugLoggingEnabled && debugLoggedCount < SKIPPED_USER_DEBUG_LOG_CAP) {
      debugLoggedCount += 1;
      logger.debug('Skipped Keycloak user during IAM sync due to instance mismatch', {
        operation: 'sync_keycloak_users',
        subject_ref: toSubjectRef(user.externalId),
        user_instance_id: userInstanceId,
        expected_instance_id: expectedInstanceId,
      });
    }
  }

  return { matchingUsers, skippedCount, skippedInstanceIds };
};

const mapSyncErrorResponse = (error: unknown, requestId?: string): Response | undefined => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak-Benutzer konnten nicht geladen werden.',
      requestId
    );
  }
  if (errorMessage.startsWith('pii_encryption_required:')) {
    return createApiError(
      503,
      'internal_error',
      'PII-Verschlüsselung ist nicht konfiguriert.',
      requestId
    );
  }
  return undefined;
};

export const runKeycloakUserImportSync = async (input: {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
}): Promise<{
  report: IamUserImportSyncReport;
  skippedCount: number;
  skippedInstanceIds: ReadonlySet<string>;
}> => {
  const listedUsers = await listAllKeycloakUsers();
  const { matchingUsers, skippedCount, skippedInstanceIds } = collectSyncCandidates(
    listedUsers,
    input.instanceId
  );

  const report = await withInstanceScopedDb(input.instanceId, async (client) => {
    let importedCount = 0;
    let updatedCount = 0;

    for (const user of matchingUsers) {
      const result = await upsertIdentityUser(client, {
        instanceId: input.instanceId,
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
      skippedCount,
      totalKeycloakUsers: listedUsers.length,
    };

    if (input.actorAccountId) {
      await emitActivityLog(client, {
        instanceId: input.instanceId,
        accountId: input.actorAccountId,
        subjectId: input.actorAccountId,
        eventType: 'user.keycloak_import_synced',
        result: 'success',
        payload: {
          imported_count: summary.importedCount,
          updated_count: summary.updatedCount,
          skipped_count: summary.skippedCount,
          total_keycloak_users: summary.totalKeycloakUsers,
        },
        requestId: input.requestId,
        traceId: input.traceId,
      });
    }

    return summary;
  });

  return {
    report,
    skippedCount,
    skippedInstanceIds,
  };
};

export const syncUsersFromKeycloakInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveSyncActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  const { actor } = actorResolution;

  try {
    const { report, skippedCount, skippedInstanceIds } = await runKeycloakUserImportSync({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      requestId: actor.requestId,
      traceId: actor.traceId,
    });

    if (skippedCount > 0) {
      logger.info('Keycloak user sync skipped users because instance ids did not match', {
        operation: 'sync_keycloak_users',
        skipped_count: skippedCount,
        sample_instance_ids: Array.from(skippedInstanceIds).join(','),
        ...buildLogContext(actor.instanceId, { includeTraceId: true }),
      });
    }

    iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'success' });
    return jsonResponse(200, asApiItem(report, actor.requestId));
  } catch (error) {
    const mappedError = mapSyncErrorResponse(error, actor.requestId);
    if (mappedError) {
      iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
      return mappedError;
    }

    logger.error('IAM keycloak user import failed', {
      operation: 'sync_keycloak_users',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    iamUserOperationsCounter.add(1, { action: 'sync_keycloak_users', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Keycloak-Benutzer konnten nicht in IAM synchronisiert werden.',
      actor.requestId
    );
  }
};
