import {
  createSsfAuthorizationProjection,
  SSF_TENANT_PERMISSION_IDS,
} from './authorization-projection.js';
import {
  createSsfAuthorizationProjectionReconciler,
  type SsfAuthorizationProjectionReconcileResult,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from './authorization-projection-reconciler.js';

export type SsfAuthorizationProjectionSource = Readonly<{
  readSubjects(input: { instanceId: string; permissionIds: readonly string[] }): Promise<
    readonly Readonly<{
      keycloakSubject: string;
      roleNames: readonly string[];
      permissionIds: readonly string[];
    }>[]
  >;
}>;

export type SsfAuthorizationProjectionRuntime = Readonly<{
  reconcile(instanceId: string): Promise<SsfAuthorizationProjectionReconcileResult>;
  readiness(instanceId: string): Promise<string | null>;
}>;

export const createSsfAuthorizationProjectionRuntime = (dependencies: {
  readonly source: SsfAuthorizationProjectionSource;
  readonly store: SsfAuthorizationProjectionStore;
  readonly target: SsfAuthorizationProjectionTarget;
  readonly readReadyRevision: (instanceId: string) => Promise<string | null>;
}): SsfAuthorizationProjectionRuntime => {
  const reconcileProjection = createSsfAuthorizationProjectionReconciler(dependencies);

  return {
    async readiness(instanceId) {
      const revision = await dependencies.readReadyRevision(instanceId);
      if (!revision || !(await dependencies.target.isReady(instanceId, revision))) return null;
      return (await dependencies.readReadyRevision(instanceId)) === revision ? revision : null;
    },
    async reconcile(instanceId) {
      const sourceSubjects = await dependencies.source.readSubjects({
        instanceId,
        permissionIds: SSF_TENANT_PERMISSION_IDS,
      });
      const subjects = sourceSubjects.map(({ keycloakSubject, roleNames, permissionIds }) => ({
        subject: keycloakSubject,
        roleNames,
        permissionIds,
      }));
      return reconcileProjection(createSsfAuthorizationProjection({ instanceId, subjects }));
    },
  };
};
