import type { InstanceProvisioningRun } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  readStep,
  requireDependency,
  RETRY_MILLISECONDS,
  updateClaimedRun,
} from './tenant-provisioning-state.js';
import type { ParentStep } from './tenant-provisioning-state.js';
import { runTenantProvisioningStep } from './tenant-provisioning-steps.js';
import { assertTenantProvisioningSnapshotCurrent } from './tenant-provisioning-snapshot.js';

const logger = createSdkLogger({
  component: 'iam-instance-registry-tenant-provisioning',
  level: 'info',
});

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const LEASE_MILLISECONDS = 30_000;
const LEASE_HEARTBEAT_MILLISECONDS = 10_000;
const TERMINAL_ERROR_CODES = new Set([
  'instance_not_found',
  'kassel_auth_issuer_missing',
  'kassel_ingress_evidence_missing',
  'kassel_ingress_redirect_invalid',
  'kassel_login_callback_invalid',
  'kassel_login_redirect_invalid',
  'kassel_tenant_ingress_mode_disabled',
  'kassel_traefik_dynamic_dir_missing',
  'keycloak_provisioning_failed',
  'module_readiness_blocked',
  'provisioning_snapshot_drift',
  'provisioning_instance_status_invalid',
  'tenant_ingress_hostname_invalid_label',
  'tenant_ingress_hostname_invalid_label_count',
  'tenant_ingress_hostname_outside_parent_domain',
  'tenant_ingress_hostname_punycode_rejected',
  'tenant_ingress_hostname_reserved',
  'tenant_ingress_instance_hostname_mismatch',
  'tenant_ingress_service_invalid',
]);

const isTerminalError = (error: unknown): boolean => {
  const code = error instanceof Error ? error.message : String(error);
  return TERMINAL_ERROR_CODES.has(code);
};

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return /^[a-z][a-z0-9_:-]{2,100}$/u.test(message) ? message : 'tenant_provisioning_step_failed';
};

const executeWithLeaseHeartbeat = async <T>(
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  workerId: string,
  execute: () => Promise<T>
): Promise<T> => {
  const renewLease = async (): Promise<void> => {
    const renewed = await deps.repository.renewProvisioningRunLease({
      runId: run.id,
      leaseOwner: workerId,
      leaseExpiresAt: new Date(Date.now() + LEASE_MILLISECONDS).toISOString(),
    });
    if (!renewed) throw new Error('provisioning_claim_lost');
  };
  await renewLease();
  let renewing = false;
  const timer = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void renewLease()
      .catch((error) => {
        logger.warn('tenant_provisioning_lease_heartbeat_failed', {
          operation: 'create_instance',
          instance_id: run.instanceId,
          run_id: run.id,
          error_code: errorCode(error),
        });
      })
      .finally(() => {
        renewing = false;
      });
  }, LEASE_HEARTBEAT_MILLISECONDS);
  timer.unref();
  try {
    return await execute();
  } finally {
    clearInterval(timer);
  }
};

const failRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  workerId: string,
  stepKey: ParentStep,
  error: unknown,
  now: Date
) => {
  const code = errorCode(error);
  await deps.repository.setInstanceStatus({
    instanceId: run.instanceId,
    status: 'failed',
    actorId: run.actorId,
    requestId: run.requestId,
  });
  logger.error('tenant_provisioning_failed', {
    operation: 'create_instance',
    result: 'failed',
    instance_id: run.instanceId,
    run_id: run.id,
    step_key: stepKey,
    error_code: code,
  });
  return updateClaimedRun(deps, run, workerId, {
    status: 'failed',
    stepKey,
    errorCode: code,
    errorMessage: 'Mandanten-Provisionierung fehlgeschlagen.',
    terminalEvidence: { failedStep: stepKey, errorCode: code },
    completedAt: now.toISOString(),
  });
};

export const processNextTenantProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  input: { readonly workerId: string; readonly now?: Date }
): Promise<InstanceProvisioningRun | null> => {
  const now = input.now ?? new Date();
  const run = await deps.repository.claimNextProvisioningRun({
    workerId: input.workerId,
    leaseExpiresAt: new Date(now.getTime() + LEASE_MILLISECONDS).toISOString(),
    parentDomain: KASSEL_PARENT_DOMAIN,
  });
  if (!run) return null;
  const execute = async (lockedDeps: InstanceRegistryServiceDeps) => {
    const current = (await lockedDeps.repository.listProvisioningRuns(run.instanceId)).find(
      (candidate) => candidate.id === run.id && candidate.leaseOwner === input.workerId
    );
    if (!current) return null;
    const instance = await lockedDeps.repository.getInstanceById(run.instanceId);
    try {
      if (!instance) throw new Error('instance_not_found');
      if (!['requested', 'validated', 'provisioning'].includes(instance.status)) {
        throw new Error('provisioning_instance_status_invalid');
      }
      assertTenantProvisioningSnapshotCurrent(current, instance);
      if (now.getTime() >= new Date(current.deadlineAt).getTime()) {
        throw new Error('provisioning_deadline_exceeded');
      }
      return await runTenantProvisioningStep({
        deps: lockedDeps,
        run: current,
        instance,
        workerId: input.workerId,
        now,
      });
    } catch (error) {
      const terminal =
        isTerminalError(error) || now.getTime() >= new Date(current.deadlineAt).getTime();
      if (terminal) {
        return failRun(lockedDeps, current, input.workerId, readStep(current), error, now);
      }
      logger.warn('tenant_provisioning_retry_scheduled', {
        operation: 'create_instance',
        instance_id: current.instanceId,
        run_id: current.id,
        step_key: readStep(current),
        error_code: errorCode(error),
      });
      return updateClaimedRun(lockedDeps, current, input.workerId, {
        stepKey: readStep(current),
        nextAttemptAt: new Date(now.getTime() + RETRY_MILLISECONDS).toISOString(),
        errorCode: errorCode(error),
        errorMessage: 'Provisionierung wird erneut versucht.',
      });
    }
  };
  const withInstanceProvisioningLock = requireDependency(
    deps.withInstanceProvisioningLock,
    'dependency_missing_withInstanceProvisioningLock'
  );
  return withInstanceProvisioningLock(run.instanceId, (lockedDeps) =>
    executeWithLeaseHeartbeat(deps, run, input.workerId, () => execute(lockedDeps))
  );
};
