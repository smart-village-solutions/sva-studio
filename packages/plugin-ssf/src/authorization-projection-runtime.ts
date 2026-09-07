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
  readSubjects(input: {
    instanceId: string;
    permissionIds: readonly string[];
  }): Promise<
    readonly Readonly<{
      keycloakSubject: string;
      roleNames: readonly string[];
      permissionIds: readonly string[];
    }>[]
  >;
}>;

export type SsfAuthorizationProjectionRuntime = Readonly<{
  reconcile(instanceId: string): Promise<SsfAuthorizationProjectionReconcileResult>;
}>;

export const createSsfAuthorizationProjectionRuntime = (dependencies: {
  readonly source: SsfAuthorizationProjectionSource;
  readonly store: SsfAuthorizationProjectionStore;
  readonly target: SsfAuthorizationProjectionTarget;
}): SsfAuthorizationProjectionRuntime => {
  const reconcileProjection = createSsfAuthorizationProjectionReconciler(dependencies);

  return {
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
