import { isTenantTechnicalKeycloakRole } from './role-governance.js';
import { fingerprintRoleCatalog, loadManagedRoleCatalog } from './reconcile-catalog.js';
import {
  buildReconcileRoleIndexes,
  hydrateRoleDetailsForReconciliation,
  isStudioManagedIdentityRole,
  isTechnicalIdentityRole,
} from './reconcile-identity.js';
import { reconcileDatabaseRoles } from './reconcile-database.js';
import { reconcileManagedIdentityRoles } from './reconcile-import.js';
import { buildReconcileReport, reportRemainingPotentialStudioRoles } from './reconcile-report.js';
import type {
  ReconcileReport,
  ReconcileRoleEntry,
  RoleCatalogReconciliationDeps,
} from './reconcile-types.js';
export { readRoleCatalogFingerprint } from './reconcile-catalog.js';
export type { ReconcileReport, RoleCatalogReconciliationDeps } from './reconcile-types.js';

type ImportFailure = NonNullable<NonNullable<ReconcileReport['debug']>['importFailures']>[number];

export const runRoleCatalogReconciliation = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
  expectedRoleCatalogFingerprint?: string;
}): Promise<ReconcileReport> => {
  const deps = input.deps;
  const identityProvider = await deps.resolveIdentityProviderForInstance(input.instanceId);
  if (!identityProvider) {
    throw new Error('identity_provider_unavailable');
  }

  const dbRoles = await loadManagedRoleCatalog(deps, input.instanceId);
  if (
    input.expectedRoleCatalogFingerprint &&
    fingerprintRoleCatalog(dbRoles) !== input.expectedRoleCatalogFingerprint
  ) {
    throw new Error('role_catalog_fingerprint_stale');
  }
  const technicalDbRoles = dbRoles.filter((role) => isTenantTechnicalKeycloakRole(role));

  const listedIdpRoles = await deps.trackKeycloakCall('reconcile_list_roles', () =>
    identityProvider.provider.listRoles()
  );
  const idpRoles = await hydrateRoleDetailsForReconciliation(
    deps,
    identityProvider,
    listedIdpRoles
  );
  const managedIdpRoles = idpRoles.filter((role) =>
    isStudioManagedIdentityRole(role, input.instanceId)
  );
  const technicalManagedIdpRoles = managedIdpRoles.filter(isTechnicalIdentityRole);
  const { idpByExternalName, idpByRoleKey, dbByExternalName, dbByRoleKey } =
    buildReconcileRoleIndexes({ technicalDbRoles, technicalManagedIdpRoles });
  const matchedIdentityExternalNames = new Set<string>();
  const matchedIdentityRoleKeys = new Set<string>();

  const entries: ReconcileRoleEntry[] = [];
  const importFailures: ImportFailure[] = [];

  await reconcileDatabaseRoles({
    deps,
    dbRoles: technicalDbRoles,
    idpByExternalName,
    idpByRoleKey,
    matchedIdentityExternalNames,
    matchedIdentityRoleKeys,
    entries,
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    identityProvider,
  });

  await reconcileManagedIdentityRoles({
    deps,
    managedIdpRoles,
    dbByExternalName,
    dbByRoleKey,
    matchedIdentityExternalNames,
    matchedIdentityRoleKeys,
    entries,
    importFailures,
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    includeDiagnostics: input.includeDiagnostics,
  });

  reportRemainingPotentialStudioRoles({
    idpRoles: managedIdpRoles,
    idpByExternalName,
    dbByExternalName,
    entries,
  });

  const report = buildReconcileReport({
    entries,
    instanceId: input.instanceId,
    includeDiagnostics: input.includeDiagnostics,
    dbRoles,
    listedIdpRoles,
    hydratedIdpRoles: idpRoles,
    managedIdpRoles,
    importFailures,
  });

  deps.setRoleDriftBacklog(input.instanceId, report.failedCount + report.requiresManualActionCount);
  return report;
};
