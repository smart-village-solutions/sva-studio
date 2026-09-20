import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const activeCreateStatuses = new Set(['requested', 'provisioning']);

const SAFE_TENANT_PROVISIONING_RETRY_CODES = new Set([
  'post_commit_wakeup_failed',
  'kassel_ingress_probe_failed',
  'kassel_login_probe_failed',
  'tenant_iam_unavailable',
  'tenant_iam_access_not_ready',
  'tenant_iam_roles_reconcile_not_ready',
  'kassel_traefik_dynamic_dir_missing',
]);

export const isTenantProvisioningFailureRetryable = (run: {
  readonly status: string;
  readonly errorCode?: string;
}): boolean =>
  run.status === 'failed' &&
  Boolean(
    run.errorCode &&
    (SAFE_TENANT_PROVISIONING_RETRY_CODES.has(run.errorCode) ||
      run.errorCode.startsWith('dependency_missing_'))
  );

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
      (activeCreateStatuses.has(run.status) ||
        (run.status === 'validated' && !run.completedAt) ||
        isActiveRetryReservation(run))
  );
  if (activeRun) throw new Error('instance_configuration_change_blocked');
};

export const shouldExposeAutomatedProvisioning = (
  deps: InstanceRegistryServiceDeps,
  input: { readonly parentDomain: string }
): boolean => deps.isAutomatedTenantProvisioningEnabled?.(input) === true;

export const requiresAutomatedProvisioningEvidence = (run: {
  readonly snapshotVersion?: string;
  readonly desiredSnapshot: Readonly<{ automationMode?: string }>;
}): boolean =>
  run.snapshotVersion === '2.0' && run.desiredSnapshot.automationMode === 'kassel-traefik-file';
