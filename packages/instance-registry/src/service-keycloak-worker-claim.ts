import type { InstanceKeycloakProvisioningRun } from '@sva/core';

import type { InstanceRegistryServiceDeps } from './service-types.js';

export const processNextProvisioningClaim = async (
  deps: InstanceRegistryServiceDeps,
  processClaimed: (
    lockedDeps: InstanceRegistryServiceDeps,
    run: InstanceKeycloakProvisioningRun
  ) => Promise<unknown>,
  claimFilter?: { createdAtOrAfter?: string }
) => {
  const run = await deps.repository.claimNextKeycloakProvisioningRun(claimFilter);
  if (!run) {
    return null;
  }
  if (!deps.withInstanceProvisioningLock) {
    throw new Error('dependency_missing_withInstanceProvisioningLock');
  }
  return deps.withInstanceProvisioningLock(run.instanceId, (lockedDeps) =>
    processClaimed(lockedDeps, run)
  );
};
