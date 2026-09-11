import type { InstanceKeycloakProvisioningRun } from '@sva/core';

import type { InstanceRegistryServiceDeps } from './service-types.js';

export const hasProvisioningWorkerDependencies = (
  deps: InstanceRegistryServiceDeps
): boolean =>
  Boolean(
    deps.provisionInstanceAuth &&
      deps.readKeycloakStateViaProvisioner &&
      deps.getKeycloakPreflight &&
      deps.planKeycloakProvisioning
  );

export const processNextProvisioningClaim = async (
  deps: InstanceRegistryServiceDeps,
  processClaimed: (
    lockedDeps: InstanceRegistryServiceDeps,
    run: InstanceKeycloakProvisioningRun
  ) => Promise<unknown>,
  claimFilter?: { createdAtOrAfter?: string }
) => {
  if (!deps.withInstanceProvisioningLock) {
    throw new Error('dependency_missing_withInstanceProvisioningLock');
  }
  const run = await deps.repository.claimNextKeycloakProvisioningRun(claimFilter);
  if (!run) {
    return null;
  }
  return deps.withInstanceProvisioningLock(run.instanceId, async (lockedDeps) => {
    const persistedRun = await lockedDeps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
    if (!persistedRun || persistedRun.overallStatus !== 'running') {
      return persistedRun;
    }
    return processClaimed({ ...deps, ...lockedDeps }, persistedRun);
  });
};
