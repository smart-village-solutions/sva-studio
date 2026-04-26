import { createHash } from 'node:crypto';
import type { IamUserImportSyncReport } from '@sva/core';
import {
  createSyncUsersFromKeycloakHandlerInternal,
  createUserImportPersistence,
  IamSchemaDriftError,
} from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { IdentityListedUser } from '../identity-provider-port.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import type { QueryClient } from '../shared/db-helpers.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { buildLogContext } from '../shared/log-context.js';

import { ADMIN_ROLES, PLATFORM_RATE_LIMIT_INSTANCE_ID } from './constants.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { runPlatformKeycloakUserSync } from './platform-iam.js';
import { consumeRateLimit } from './rate-limit.js';
import type { ActorInfo } from './types.js';
import {
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';

const KEYCLOAK_PAGE_SIZE = 100;
const SKIPPED_USER_DEBUG_LOG_CAP = 20;
const SKIPPED_USER_INSTANCE_SAMPLE_CAP = 5;

const isPlatformIdentityProviderConfigurationError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'platform_identity_provider_not_configured';

const readSingleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const matchesInstanceId = (
  user: IdentityListedUser,
  instanceId: string,
  acceptUsersWithoutInstanceIdAttribute: boolean
): boolean => {
  const configuredInstanceIds = user.attributes?.instanceId;
  if (!configuredInstanceIds || configuredInstanceIds.length === 0) {
    return acceptUsersWithoutInstanceIdAttribute;
  }

  return configuredInstanceIds.includes(instanceId);
};

const normalizeOptionalText = (value: string | undefined | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const hasRequiredProfileFields = (user: IdentityListedUser): boolean =>
  normalizeOptionalText(user.email) !== undefined &&
  normalizeOptionalText(user.firstName) !== undefined &&
  normalizeOptionalText(user.lastName) !== undefined;

const looksLikeEmail = (value: string | undefined): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) {
    return false;
  }

  const domain = value.slice(atIndex + 1);
  return domain.length > 2 && !domain.includes(' ') && domain.includes('.');
};

const toSubjectRef = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);

const USER_SYNC_SAVEPOINT = 'iam_keycloak_user_sync_item';

class KeycloakUserSyncBlockedError extends Error {
  readonly reason: 'tenant_admin_client_not_configured';

  constructor(reason: 'tenant_admin_client_not_configured', message: string) {
    super(message);
    this.name = 'KeycloakUserSyncBlockedError';
    this.reason = reason;
  }
}

class KeycloakUserSyncManualReviewError extends Error {
  readonly reason: 'identity_profile_incomplete';

  constructor(reason: 'identity_profile_incomplete', message: string) {
    super(message);
    this.name = 'KeycloakUserSyncManualReviewError';
    this.reason = reason;
  }
}

const { loadLocalProfileSeed, upsertIdentityUser } = createUserImportPersistence({ logger });

const repairIdentityUserProfileIfPossible = async (
  client: QueryClient,
  input: {
    instanceId: string;
    user: IdentityListedUser;
    identityProvider: NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>;
    requestId?: string;
    traceId?: string;
  }
): Promise<{ user: IdentityListedUser; repaired: boolean }> => {
  const localSeed = await loadLocalProfileSeed(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.user.externalId,
  });

  const username = normalizeOptionalText(input.user.username) ?? localSeed?.username;
  const email =
    normalizeOptionalText(input.user.email) ??
    localSeed?.email ??
    (looksLikeEmail(username) ? username : undefined);
  const firstName = normalizeOptionalText(input.user.firstName) ?? localSeed?.firstName;
  const lastName = normalizeOptionalText(input.user.lastName) ?? localSeed?.lastName;

  const needsRepair =
    normalizeOptionalText(input.user.email) === undefined ||
    normalizeOptionalText(input.user.firstName) === undefined ||
    normalizeOptionalText(input.user.lastName) === undefined;

  const canRepair =
    needsRepair &&
    (email !== normalizeOptionalText(input.user.email) ||
      firstName !== normalizeOptionalText(input.user.firstName) ||
      lastName !== normalizeOptionalText(input.user.lastName));

  if (!canRepair) {
    return { user: input.user, repaired: false };
  }

  await trackKeycloakCall('repair_imported_user_profile', () =>
    input.identityProvider.provider.updateUser(input.user.externalId, {
      ...(username ? { username } : {}),
      ...(email ? { email } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    })
  );

  logger.info('Keycloak user profile repaired during IAM sync', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    auth_realm: input.identityProvider.realm,
    provider_source: input.identityProvider.source,
    request_id: input.requestId,
    trace_id: input.traceId,
    subject_ref: toSubjectRef(input.user.externalId),
    repaired_email: email !== normalizeOptionalText(input.user.email),
    repaired_first_name: firstName !== normalizeOptionalText(input.user.firstName),
    repaired_last_name: lastName !== normalizeOptionalText(input.user.lastName),
  });

  return {
    repaired: true,
    user: {
      ...input.user,
      ...(username ? { username } : {}),
      ...(email ? { email } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    },
  };
};

const listAllKeycloakUsers = async (
  instanceId: string
): Promise<{
  readonly resolution: NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>;
  readonly users: readonly IdentityListedUser[];
}> => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    throw new KeycloakUserSyncBlockedError(
      'tenant_admin_client_not_configured',
      'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.'
    );
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
      return {
        resolution: identityProvider,
        users,
      };
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
  expectedInstanceId: string,
  options?: {
    readonly acceptUsersWithoutInstanceIdAttribute?: boolean;
  }
): {
  matchingUsers: IdentityListedUser[];
  matchedWithoutInstanceAttributeCount: number;
  skippedCount: number;
  skippedInstanceIds: ReadonlySet<string>;
} => {
  const matchingUsers: IdentityListedUser[] = [];
  let matchedWithoutInstanceAttributeCount = 0;
  const debugLoggingEnabled = logger.isLevelEnabled('debug');
  let skippedCount = 0;
  let debugLoggedCount = 0;
  const skippedInstanceIds = new Set<string>();
  const acceptUsersWithoutInstanceIdAttribute =
    options?.acceptUsersWithoutInstanceIdAttribute === true;

  for (const user of listedUsers) {
    const hasInstanceIdAttribute = (user.attributes?.instanceId?.length ?? 0) > 0;
    if (matchesInstanceId(user, expectedInstanceId, acceptUsersWithoutInstanceIdAttribute)) {
      matchingUsers.push(user);
      if (!hasInstanceIdAttribute && acceptUsersWithoutInstanceIdAttribute) {
        matchedWithoutInstanceAttributeCount += 1;
      }
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

  return {
    matchingUsers,
    matchedWithoutInstanceAttributeCount,
    skippedCount,
    skippedInstanceIds,
  };
};

const mapSyncErrorResponse = (error: unknown, requestId?: string): Response | undefined => {
  if (error instanceof KeycloakUserSyncBlockedError) {
    return createApiError(
      409,
      'tenant_admin_client_not_configured',
      'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
      requestId,
      {
        dependency: 'keycloak',
        execution_mode: 'tenant_admin',
        reason_code: 'registry_or_provisioning_drift_blocked',
      }
    );
  }
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
  if (error instanceof IamSchemaDriftError) {
    return createApiError(
      503,
      'database_unavailable',
      'Das IAM-Schema ist veraltet. Keycloak-Benutzer konnten nicht synchronisiert werden.',
      requestId,
      {
        dependency: 'database',
        expected_migration: error.expectedMigration,
        reason_code: 'schema_drift',
        schema_object: error.schemaObject,
      }
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
  const startedAt = Date.now();
  logger.info('sync_keycloak_users_started', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    actor_account_id: input.actorAccountId,
    request_id: input.requestId,
    trace_id: input.traceId,
  });
  const { resolution, users: listedUsers } = await listAllKeycloakUsers(input.instanceId);
  const acceptUsersWithoutInstanceIdAttribute = resolution.source === 'instance';
  const { matchingUsers, matchedWithoutInstanceAttributeCount, skippedCount, skippedInstanceIds } =
    collectSyncCandidates(listedUsers, input.instanceId, {
      acceptUsersWithoutInstanceIdAttribute,
    });

  if (matchedWithoutInstanceAttributeCount > 0) {
    logger.info('Keycloak user sync matched users by realm scope without instance attribute', {
      operation: 'sync_keycloak_users',
      instance_id: input.instanceId,
      auth_realm: resolution.realm,
      provider_source: resolution.source,
      matched_without_instance_attribute_count: matchedWithoutInstanceAttributeCount,
      request_id: input.requestId,
      trace_id: input.traceId,
    });
  }

  if (skippedCount > 0) {
    logger.info('Keycloak user sync skipped users because instance ids did not match', {
      operation: 'sync_keycloak_users',
      instance_id: input.instanceId,
      auth_realm: resolution.realm,
      provider_source: resolution.source,
      skipped_count: skippedCount,
      sample_instance_ids: [...skippedInstanceIds].join(','),
      request_id: input.requestId,
      trace_id: input.traceId,
    });
  }

  const skippedInstanceIdSamples = [...skippedInstanceIds];
  const diagnostics =
    matchedWithoutInstanceAttributeCount > 0 || skippedInstanceIdSamples.length > 0
      ? {
          authRealm: resolution.realm,
          providerSource: resolution.source,
          executionMode: resolution.executionMode,
          ...(matchedWithoutInstanceAttributeCount > 0
            ? { matchedWithoutInstanceAttributeCount }
            : {}),
          ...(skippedInstanceIdSamples.length > 0
            ? { skippedInstanceIds: skippedInstanceIdSamples }
            : {}),
        }
      : undefined;

  const report = await withInstanceScopedDb(input.instanceId, async (client) => {
    let importedCount = 0;
    let updatedCount = 0;
    let repairedProfileCount = 0;
    let manualReviewCount = 0;

    for (const user of matchingUsers) {
      await client.query(`SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
      try {
        const repaired = await repairIdentityUserProfileIfPossible(client, {
          instanceId: input.instanceId,
          user,
          identityProvider: resolution,
          requestId: input.requestId,
          traceId: input.traceId,
        });
        if (repaired.repaired) {
          repairedProfileCount += 1;
        }
        if (!hasRequiredProfileFields(repaired.user)) {
          throw new KeycloakUserSyncManualReviewError(
            'identity_profile_incomplete',
            'Keycloak-Benutzerprofil ist unvollständig und erfordert manuelle Prüfung.'
          );
        }
        const result = await upsertIdentityUser(client, {
          instanceId: input.instanceId,
          user: repaired.user,
        });
        if (result.created) {
          importedCount += 1;
        } else {
          updatedCount += 1;
        }
        await client.query(`RELEASE SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
        await client.query(`RELEASE SAVEPOINT ${USER_SYNC_SAVEPOINT}`);

        if (error instanceof KeycloakUserSyncManualReviewError) {
          manualReviewCount += 1;
          logger.warn('Keycloak user sync left a user in manual review', {
            operation: 'sync_keycloak_users',
            instance_id: input.instanceId,
            auth_realm: resolution.realm,
            provider_source: resolution.source,
            request_id: input.requestId,
            trace_id: input.traceId,
            subject_ref: toSubjectRef(user.externalId),
            reason: error.reason,
            error: error.message,
          });
          continue;
        }

        if (
          error instanceof KeycloakUserSyncBlockedError ||
          error instanceof KeycloakAdminRequestError ||
          error instanceof KeycloakAdminUnavailableError ||
          error instanceof IamSchemaDriftError
        ) {
          throw error;
        }

        throw error;
      }
    }

    const correctedCount = importedCount + updatedCount;
    const outcome =
      manualReviewCount > 0
        ? correctedCount > 0
          ? 'partial_failure'
          : 'failed'
        : 'success';

    const summary: IamUserImportSyncReport = {
      outcome,
      checkedCount: matchingUsers.length,
      correctedCount,
      manualReviewCount,
      importedCount,
      updatedCount,
      skippedCount,
      totalKeycloakUsers: listedUsers.length,
      ...(diagnostics ? { diagnostics } : {}),
      ...(repairedProfileCount > 0 ? { repairedProfileCount } : {}),
    };

    if (input.actorAccountId) {
      try {
        await emitActivityLog(client, {
          instanceId: input.instanceId,
          accountId: input.actorAccountId,
          subjectId: input.actorAccountId,
          eventType: 'user.keycloak_import_synced',
          result: 'success',
          payload: {
            checked_count: summary.checkedCount,
            corrected_count: summary.correctedCount,
            manual_review_count: summary.manualReviewCount,
            imported_count: summary.importedCount,
            updated_count: summary.updatedCount,
            skipped_count: summary.skippedCount,
            total_keycloak_users: summary.totalKeycloakUsers,
            repaired_profile_count: repairedProfileCount,
          },
          requestId: input.requestId,
          traceId: input.traceId,
        });
      } catch (error) {
        logger.warn('Skipped audit log for Keycloak user sync after successful import', {
          operation: 'sync_keycloak_users',
          instance_id: input.instanceId,
          actor_account_id: input.actorAccountId,
          request_id: input.requestId,
          trace_id: input.traceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return summary;
  });

  logger.info('sync_keycloak_users_completed', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    actor_account_id: input.actorAccountId,
    request_id: input.requestId,
    trace_id: input.traceId,
    outcome: report.outcome,
    checked_count: report.checkedCount,
    corrected_count: report.correctedCount,
    manual_review_count: report.manualReviewCount,
    imported_count: report.importedCount,
    updated_count: report.updatedCount,
    skipped_count: report.skippedCount,
    total_keycloak_users: report.totalKeycloakUsers,
    duration_ms: Date.now() - startedAt,
  });

  return {
    report,
    skippedCount,
    skippedInstanceIds,
  };
};

export const syncUsersFromKeycloakInternal = createSyncUsersFromKeycloakHandlerInternal({
  asApiItem,
  buildLogContext,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  iamUserOperationsCounter,
  isPlatformIdentityProviderConfigurationError,
  jsonResponse,
  logger,
  mapSyncErrorResponse,
  platformRateLimitInstanceId: PLATFORM_RATE_LIMIT_INSTANCE_ID,
  requireRoles,
  resolveSyncActor,
  runKeycloakUserImportSync,
  runPlatformKeycloakUserSync,
  validateCsrf,
});
