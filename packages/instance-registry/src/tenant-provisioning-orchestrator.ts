import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';
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

const logger = createSdkLogger({
  component: 'iam-instance-registry-tenant-provisioning',
  level: 'info',
});

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const LEASE_MILLISECONDS = 30_000;
const assertSnapshotCurrent = (
  run: InstanceProvisioningRun,
  instance: InstanceRegistryRecord
): void => {
  const snapshot = run.desiredSnapshot;
  if (
    run.snapshotVersion !== '2.0' ||
    snapshot.instanceId !== instance.instanceId ||
    snapshot.parentDomain !== instance.parentDomain ||
    snapshot.primaryHostname !== instance.primaryHostname ||
    snapshot.realmMode !== instance.realmMode ||
    snapshot.authRealm !== instance.authRealm ||
    snapshot.authClientId !== instance.authClientId ||
    snapshot.authIssuerUrl !== instance.authIssuerUrl ||
    snapshot.payloadFingerprint !== run.payloadFingerprint
  ) {
    throw new Error('provisioning_snapshot_drift');
  }
};

const isTerminalError = (error: unknown): boolean => {
  const code = error instanceof Error ? error.message : String(error);
  return (
    code.startsWith('kassel_') ||
    code === 'provisioning_snapshot_drift' ||
    code === 'keycloak_provisioning_failed' ||
    code === 'module_readiness_blocked' ||
    code === 'instance_not_found'
  );
};

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return /^[a-z][a-z0-9_:-]{2,100}$/u.test(message) ? message : 'tenant_provisioning_step_failed';
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
      assertSnapshotCurrent(current, instance);
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
  return requireDependency(
    deps.withInstanceProvisioningLock,
    'dependency_missing_withInstanceProvisioningLock'
  )(run.instanceId, execute);
};
