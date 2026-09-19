import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const activeCreateStatuses = new Set(['requested', 'validated', 'provisioning']);

const isActiveRetryReservation = (run: {
  readonly status: string;
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: string;
}): boolean =>
  run.status === 'failed' &&
  run.leaseOwner?.startsWith('retry:') === true &&
  (run.leaseExpiresAt ? new Date(run.leaseExpiresAt).getTime() > Date.now() : false);

export const assertNoActiveTenantProvisioning = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<void> => {
  const activeRun = (await repository.listProvisioningRuns(instanceId)).some(
    (run) =>
      run.operation === 'create' &&
      run.snapshotVersion === '2.0' &&
      run.desiredSnapshot.automationMode === 'kassel-traefik-file' &&
      (activeCreateStatuses.has(run.status) || isActiveRetryReservation(run))
  );
  if (activeRun) throw new Error('instance_configuration_change_blocked');
};

export const shouldExposeAutomatedProvisioning = (
  deps: InstanceRegistryServiceDeps,
  input: { readonly parentDomain: string }
): boolean => deps.isAutomatedTenantProvisioningEnabled?.(input) === true;
