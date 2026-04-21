import type { IamUserImportSyncReport } from '@sva/core';

import { listAllPlatformUsers } from './platform-iam.js';
import { logger } from './shared-observability.js';

export const runPlatformKeycloakUserSync = async (input: {
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<IamUserImportSyncReport> => {
  const { realm, users } = await listAllPlatformUsers();
  logger.info('sync_platform_keycloak_users_completed', {
    operation: 'sync_platform_keycloak_users',
    scope_kind: 'platform',
    auth_realm: realm,
    request_id: input.requestId,
    trace_id: input.traceId,
    checked_count: users.length,
  });
  return {
    outcome: 'success',
    checkedCount: users.length,
    correctedCount: 0,
    manualReviewCount: 0,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    totalKeycloakUsers: users.length,
    diagnostics: {
      authRealm: realm,
      providerSource: 'platform',
      executionMode: 'platform_admin',
    },
  };
};
