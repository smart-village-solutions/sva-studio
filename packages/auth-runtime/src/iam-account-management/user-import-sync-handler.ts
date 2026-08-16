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
import type { AuthenticatedRequestContext } from '../middleware.js';
import type { QueryClient } from '../db.js';
import { jsonResponse } from '../db.js';
import { buildLogContext } from '../log-context.js';

import { ADMIN_ROLES, PLATFORM_RATE_LIMIT_INSTANCE_ID } from './constants.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { runPlatformKeycloakUserSync } from './platform-iam-sync.js';
import { consumeRateLimit } from './rate-limit.js';
import type { ActorInfo } from './types.js';
import {
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  requireRoles,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';

const KEYCLOAK_PAGE_SIZE = 100;
const isPlatformIdentityProviderConfigurationError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'platform_identity_provider_not_configured';

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

type IdentityProviderResolution = NonNullable<
  Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>
>;

type LocalProfileSeed = Awaited<ReturnType<typeof loadLocalProfileSeed>>;

type ResolvedProfileFields = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type ProfileRepairPlan = {
  readonly user: IdentityListedUser;
  readonly update: ResolvedProfileFields;
  readonly repairedEmail: boolean;
  readonly repairedFirstName: boolean;
  readonly repairedLastName: boolean;
};

const resolveProfileValue = (
  sourceValue: string | undefined,
  seedValue: string | undefined
): string | undefined => normalizeOptionalText(sourceValue) ?? seedValue;

const resolveProfileEmail = (
  sourceEmail: string | undefined,
  seedEmail: string | undefined,
  username: string | undefined
): string | undefined =>
  resolveProfileValue(sourceEmail, seedEmail) ?? (looksLikeEmail(username) ? username : undefined);

const resolveProfileFields = (
  user: IdentityListedUser,
  localSeed: LocalProfileSeed
): ResolvedProfileFields => {
  const username = resolveProfileValue(user.username, localSeed?.username);
  return {
    username,
    email: resolveProfileEmail(user.email, localSeed?.email, username),
    firstName: resolveProfileValue(user.firstName, localSeed?.firstName),
    lastName: resolveProfileValue(user.lastName, localSeed?.lastName),
  };
};

const toProfileUpdate = (fields: ResolvedProfileFields): ProfileRepairPlan['update'] => ({
  ...(fields.username ? { username: fields.username } : {}),
  ...(fields.email ? { email: fields.email } : {}),
  ...(fields.firstName ? { firstName: fields.firstName } : {}),
  ...(fields.lastName ? { lastName: fields.lastName } : {}),
});

const buildProfileRepairPlan = (
  user: IdentityListedUser,
  localSeed: LocalProfileSeed
): ProfileRepairPlan | undefined => {
  const sourceEmail = normalizeOptionalText(user.email);
  const sourceFirstName = normalizeOptionalText(user.firstName);
  const sourceLastName = normalizeOptionalText(user.lastName);
  const resolved = resolveProfileFields(user, localSeed);
  const repairedEmail = resolved.email !== sourceEmail;
  const repairedFirstName = resolved.firstName !== sourceFirstName;
  const repairedLastName = resolved.lastName !== sourceLastName;

  if (!repairedEmail && !repairedFirstName && !repairedLastName) {
    return undefined;
  }

  const update = toProfileUpdate(resolved);
  return {
    user: { ...user, ...update },
    update,
    repairedEmail,
    repairedFirstName,
    repairedLastName,
  };
};

const repairIdentityUserProfileIfPossible = async (
  client: QueryClient,
  input: {
    instanceId: string;
    user: IdentityListedUser;
    identityProvider: IdentityProviderResolution;
    requestId?: string;
    traceId?: string;
  }
): Promise<{ user: IdentityListedUser; repaired: boolean }> => {
  const localSeed = await loadLocalProfileSeed(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.user.externalId,
  });
  const repair = buildProfileRepairPlan(input.user, localSeed);
  if (!repair) {
    return { user: input.user, repaired: false };
  }

  await trackKeycloakCall('repair_imported_user_profile', () =>
    input.identityProvider.provider.updateUser(input.user.externalId, repair.update)
  );

  logger.info('Keycloak user profile repaired during IAM sync', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    auth_realm: input.identityProvider.realm,
    provider_source: input.identityProvider.source,
    request_id: input.requestId,
    trace_id: input.traceId,
    subject_ref: toSubjectRef(input.user.externalId),
    repaired_email: repair.repairedEmail,
    repaired_first_name: repair.repairedFirstName,
    repaired_last_name: repair.repairedLastName,
  });

  return { repaired: true, user: repair.user };
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
  const actorResolution = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: ADMIN_ROLES,
    requiredPermissionAction: 'iam.user.write',
    feature: 'iam_admin',
    scope: 'write',
    provisionMissingActorMembership: true,
  });
  if ('response' in actorResolution) {
    return { error: actorResolution.response };
  }

  return { actor: actorResolution.actor };
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
  if (
    error instanceof KeycloakAdminRequestError ||
    error instanceof KeycloakAdminUnavailableError
  ) {
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

type ImportCounters = {
  importedCount: number;
  updatedCount: number;
  repairedProfileCount: number;
  manualReviewCount: number;
};

type ImportDiagnostics = {
  readonly authRealm: string;
  readonly providerSource: IdentityProviderResolution['source'];
  readonly executionMode: IdentityProviderResolution['executionMode'];
};

const resolveImportOutcome = (
  correctedCount: number,
  manualReviewCount: number
): IamUserImportSyncReport['outcome'] => {
  if (manualReviewCount === 0) {
    return 'success';
  }
  return correctedCount > 0 ? 'partial_failure' : 'failed';
};

const buildImportReport = (input: {
  readonly counters: ImportCounters;
  readonly diagnostics: ImportDiagnostics;
  readonly totalKeycloakUsers: number;
}): IamUserImportSyncReport => {
  const { counters } = input;
  const correctedCount = counters.importedCount + counters.updatedCount;
  return {
    outcome: resolveImportOutcome(correctedCount, counters.manualReviewCount),
    checkedCount: input.totalKeycloakUsers,
    correctedCount,
    manualReviewCount: counters.manualReviewCount,
    importedCount: counters.importedCount,
    updatedCount: counters.updatedCount,
    skippedCount: 0,
    totalKeycloakUsers: input.totalKeycloakUsers,
    diagnostics: input.diagnostics,
    ...(counters.repairedProfileCount > 0
      ? { repairedProfileCount: counters.repairedProfileCount }
      : {}),
  };
};

const logManualReview = (
  user: IdentityListedUser,
  input: {
    readonly instanceId: string;
    readonly identityProvider: IdentityProviderResolution;
    readonly requestId?: string;
    readonly traceId?: string;
  },
  error: KeycloakUserSyncManualReviewError
): void => {
  logger.warn('Keycloak user sync left a user in manual review', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    auth_realm: input.identityProvider.realm,
    provider_source: input.identityProvider.source,
    request_id: input.requestId,
    trace_id: input.traceId,
    subject_ref: toSubjectRef(user.externalId),
    reason: error.reason,
    error: error.message,
  });
};

const syncIdentityUser = async (
  client: QueryClient,
  user: IdentityListedUser,
  input: {
    readonly instanceId: string;
    readonly identityProvider: IdentityProviderResolution;
    readonly requestId?: string;
    readonly traceId?: string;
  }
): Promise<{
  readonly created?: boolean;
  readonly manualReview: boolean;
  readonly repaired: boolean;
}> => {
  await client.query(`SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
  let repairedProfile = false;
  try {
    const repaired = await repairIdentityUserProfileIfPossible(client, {
      instanceId: input.instanceId,
      user,
      identityProvider: input.identityProvider,
      requestId: input.requestId,
      traceId: input.traceId,
    });
    repairedProfile = repaired.repaired;
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
    await client.query(`RELEASE SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
    return { created: result.created, manualReview: false, repaired: repairedProfile };
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
    await client.query(`RELEASE SAVEPOINT ${USER_SYNC_SAVEPOINT}`);
    if (error instanceof KeycloakUserSyncManualReviewError) {
      logManualReview(user, input, error);
      return { manualReview: true, repaired: repairedProfile };
    }
    throw error;
  }
};

const addItemResult = (
  counters: ImportCounters,
  result: Awaited<ReturnType<typeof syncIdentityUser>>
): void => {
  if (result.repaired) {
    counters.repairedProfileCount += 1;
  }
  if (result.manualReview) {
    counters.manualReviewCount += 1;
  } else if (result.created) {
    counters.importedCount += 1;
  } else {
    counters.updatedCount += 1;
  }
};

const emitImportActivityIfPossible = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  },
  report: IamUserImportSyncReport,
  repairedProfileCount: number
): Promise<void> => {
  if (!input.actorAccountId) {
    return;
  }
  try {
    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      subjectId: input.actorAccountId,
      eventType: 'user.keycloak_import_synced',
      result: 'success',
      payload: {
        checked_count: report.checkedCount,
        corrected_count: report.correctedCount,
        manual_review_count: report.manualReviewCount,
        imported_count: report.importedCount,
        updated_count: report.updatedCount,
        skipped_count: report.skippedCount,
        total_keycloak_users: report.totalKeycloakUsers,
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
};

const importIdentityUsers = async (
  client: QueryClient,
  users: readonly IdentityListedUser[],
  input: {
    readonly instanceId: string;
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly identityProvider: IdentityProviderResolution;
    readonly diagnostics: ImportDiagnostics;
  }
): Promise<IamUserImportSyncReport> => {
  const counters: ImportCounters = {
    importedCount: 0,
    updatedCount: 0,
    repairedProfileCount: 0,
    manualReviewCount: 0,
  };
  for (const user of users) {
    addItemResult(counters, await syncIdentityUser(client, user, input));
  }
  const report = buildImportReport({
    counters,
    diagnostics: input.diagnostics,
    totalKeycloakUsers: users.length,
  });
  await emitImportActivityIfPossible(client, input, report, counters.repairedProfileCount);
  return report;
};

const runKeycloakUserImportSync = async (input: {
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
  const matchingUsers = [...listedUsers];
  const skippedCount = 0;
  const skippedInstanceIds = new Set<string>();
  const diagnostics = {
    authRealm: resolution.realm,
    providerSource: resolution.source,
    executionMode: resolution.executionMode,
  } as const;

  const report = await withInstanceScopedDb(input.instanceId, (client) =>
    importIdentityUsers(client, matchingUsers, {
      ...input,
      identityProvider: resolution,
      diagnostics,
    })
  );

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
