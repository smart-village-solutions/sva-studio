import type { IamUserImportSyncReport } from '@sva/core';
import { createSyncUsersFromKeycloakHandlerInternal, IamSchemaDriftError } from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { IdentityListedUser } from '../identity-provider-port.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
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
  iamUserOperationsCounter,
  logger,
  requireRoles,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';
import { importIdentityUsers } from './user-import-sync-persistence.js';

const KEYCLOAK_PAGE_SIZE = 100;
const isPlatformIdentityProviderConfigurationError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'platform_identity_provider_not_configured';

class KeycloakUserSyncBlockedError extends Error {
  readonly reason: 'tenant_admin_client_not_configured';

  constructor(reason: 'tenant_admin_client_not_configured', message: string) {
    super(message);
    this.name = 'KeycloakUserSyncBlockedError';
    this.reason = reason;
  }
}

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
