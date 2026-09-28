import {
  readRoleCatalogFingerprint as readIamAdminRoleCatalogFingerprint,
  runRoleCatalogReconciliation as runIamAdminRoleCatalogReconciliation,
  type ReconcileReport,
  type RoleCatalogReconciliationDeps,
} from '@sva/iam-admin';
import type { QueryClient } from '../db.js';

import {
  emitRoleAuditEvent,
  resolveIdentityProviderForInstance,
  setRoleDriftBacklog,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';

const roleCatalogReconciliationDeps: RoleCatalogReconciliationDeps = {
  emitRoleAuditEvent,
  resolveIdentityProviderForInstance,
  setRoleDriftBacklog,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
};

export type { ReconcileReport };

export const runRoleCatalogReconciliation = async (input: {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
  expectedRoleCatalogFingerprint?: string;
}): Promise<ReconcileReport> =>
  runIamAdminRoleCatalogReconciliation({
    deps: roleCatalogReconciliationDeps,
    ...input,
  });

export const readRoleCatalogFingerprint = async (instanceId: string): Promise<string> =>
  readIamAdminRoleCatalogFingerprint({
    deps: roleCatalogReconciliationDeps,
    instanceId,
  });

export const readRoleCatalogFingerprintInTransaction = async (
  instanceId: string,
  client: QueryClient
): Promise<string> =>
  readIamAdminRoleCatalogFingerprint({
    instanceId,
    deps: {
      ...roleCatalogReconciliationDeps,
      withInstanceScopedDb: async (scopedInstanceId, work) => {
        if (scopedInstanceId !== instanceId) {
          throw new Error('role_catalog_fingerprint_instance_mismatch');
        }
        return work(client);
      },
    },
  });
