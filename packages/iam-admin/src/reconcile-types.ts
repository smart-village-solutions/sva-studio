import type { IdentityProviderPort } from './identity-provider-port.js';
import type { QueryClient } from './query-client.js';

export type IdentityRole =
  Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T
    ? Exclude<T, null>
    : never;

export type ReconcileRoleEntry = {
  readonly roleId?: string;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
};

export type ReconcileReport = {
  readonly outcome: 'success' | 'partial_failure' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly manualReviewCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly ReconcileRoleEntry[];
  readonly debug?: {
    readonly instanceId: string;
    readonly dbRoleCount: number;
    readonly listedIdpRoleCount: number;
    readonly hydratedIdpRoleCount: number;
    readonly managedIdpRoleCount: number;
    readonly importFailures?: ReadonlyArray<{
      readonly roleKey?: string;
      readonly externalRoleName: string;
      readonly errorName: string;
      readonly errorMessage: string;
      readonly dbContext?: {
        readonly currentUser?: string;
        readonly sessionUser?: string;
        readonly currentRole?: string;
        readonly appInstanceId?: string;
      };
    }>;
    readonly dbRoleMatches: ReadonlyArray<{
      readonly roleKey: string;
      readonly externalRoleName: string;
      readonly hasExternalNameMatch: boolean;
      readonly hasRoleKeyMatch: boolean;
      readonly matchingExternalNameByRoleKey?: string;
      readonly listedRoleFound: boolean;
      readonly listedRoleHasAttributes: boolean;
      readonly hydratedRoleFound: boolean;
      readonly hydratedManagedBy?: string;
      readonly hydratedInstanceId?: string;
      readonly hydratedRoleKey?: string;
      readonly hydratedDisplayName?: string;
    }>;
  };
};

export type RoleImportDbContext = {
  currentUser?: string;
  sessionUser?: string;
  currentRole?: string;
  appInstanceId?: string;
};

export type RoleReconcileOperation = 'reconcile_create' | 'reconcile_update' | 'reconcile_import';
export type RoleReconcileResult = 'success' | 'failure';

export type RoleCatalogReconciliationDeps = {
  resolveIdentityProviderForInstance(
    instanceId: string
  ): Promise<{ provider: IdentityProviderPort } | null>;
  withInstanceScopedDb<T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ): Promise<T>;
  setRoleSyncState(
    client: QueryClient,
    input: {
      instanceId: string;
      roleId: string;
      syncState: 'synced' | 'failed';
      errorCode: string | null;
      syncedAt?: true;
    }
  ): Promise<void>;
  emitRoleAuditEvent(
    client: QueryClient,
    input: {
      instanceId: string;
      accountId?: string;
      roleId: string;
      eventType: 'role.reconciled';
      operation: RoleReconcileOperation;
      result: RoleReconcileResult;
      roleKey: string;
      externalRoleName: string;
      errorCode?: string;
      requestId?: string;
      traceId?: string;
    }
  ): Promise<void>;
  trackKeycloakCall<T>(operation: string, execute: () => Promise<T>): Promise<T>;
  setRoleDriftBacklog(instanceId: string, backlog: number): void;
};
