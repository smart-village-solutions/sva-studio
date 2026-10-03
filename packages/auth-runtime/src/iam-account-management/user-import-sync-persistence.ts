import type { IamUserImportSyncReport } from '@sva/core';
import { createUserImportPersistence } from '@sva/iam-admin';

import type { IdentityListedUser } from '../identity-provider-port.js';
import type { QueryClient } from '../db.js';

import { emitActivityLog, logger } from './shared.js';
import {
  hasRequiredImportEmail,
  normalizeIdentityUserProfile,
  repairIdentityUserProfileIfPossible,
  toSubjectRef,
} from './user-import-sync-profile.js';
import type { IdentityProviderResolution } from './user-import-sync-profile.js';

const USER_SYNC_SAVEPOINT = 'iam_keycloak_user_sync_item';

class KeycloakUserSyncManualReviewError extends Error {
  readonly reason: 'identity_profile_incomplete';

  constructor(reason: 'identity_profile_incomplete', message: string) {
    super(message);
    this.name = 'KeycloakUserSyncManualReviewError';
    this.reason = reason;
  }
}

const { loadLocalProfileSeed, upsertIdentityUser } = createUserImportPersistence({ logger });

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
    const repaired = await repairIdentityUserProfileIfPossible(
      client,
      {
        instanceId: input.instanceId,
        user,
        identityProvider: input.identityProvider,
        requestId: input.requestId,
        traceId: input.traceId,
      },
      loadLocalProfileSeed
    );
    repairedProfile = repaired.repaired;
    const normalizedUser = normalizeIdentityUserProfile(repaired.user);
    if (!hasRequiredImportEmail(normalizedUser)) {
      throw new KeycloakUserSyncManualReviewError(
        'identity_profile_incomplete',
        'Keycloak-Benutzerprofil enthält keine auflösbare E-Mail-Adresse und erfordert manuelle Prüfung.'
      );
    }
    const result = await upsertIdentityUser(client, {
      instanceId: input.instanceId,
      user: normalizedUser,
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

export const importIdentityUsers = async (
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
