import {
  runRoleCatalogReconciliation as runIamAdminRoleCatalogReconciliation,
  type ReconcileReport,
  type RoleCatalogReconciliationDeps,
} from '@sva/iam-admin';

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
}): Promise<ReconcileReport> =>
  runIamAdminRoleCatalogReconciliation({
    deps: roleCatalogReconciliationDeps,
    ...input,
  });
