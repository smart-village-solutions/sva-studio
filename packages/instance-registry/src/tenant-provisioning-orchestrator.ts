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
import {
  buildProvisioningFailureDiagnostics,
  readDiagnosticErrorType,
  runTenantProvisioningStep,
} from './tenant-provisioning-steps.js';
import { assertTenantProvisioningSnapshotCurrent } from './tenant-provisioning-snapshot.js';

const logger = createSdkLogger({
  component: 'iam-instance-registry-tenant-provisioning',
  level: 'info',
});

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const LEASE_MILLISECONDS = 30_000;
const LEASE_HEARTBEAT_MILLISECONDS = 10_000;
type TenantProvisioningFailurePhase =
  'execution_guard' | 'instance_validation' | 'snapshot_validation' | 'step_execution';
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
  'module_readiness_probe_invalid',
  'provisioning_step_invalid',
  'provisioning_snapshot_drift',
  'provisioning_plugin_snapshot_missing',
  'provisioning_plugin_activation_missing',
  'provisioning_instance_status_invalid',
  'tenant_ingress_hostname_invalid_label',
  'tenant_ingress_hostname_invalid_label_count',
  'tenant_ingress_hostname_outside_parent_domain',
  'tenant_ingress_hostname_punycode_rejected',
  'tenant_ingress_hostname_reserved',
  'tenant_ingress_probe_invalid',
  'tenant_ingress_publish_invalid',
  'tenant_ingress_instance_hostname_mismatch',
  'tenant_ingress_service_invalid',
  'tenant_login_probe_invalid',
  'ssf.tenant-instance-id-invalid',
]);

const isTerminalError = (error: unknown): boolean => {
  const code = error instanceof Error ? error.message : String(error);
  return TERMINAL_ERROR_CODES.has(code);
};

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return /^[a-z][a-z0-9_.:-]{2,100}$/u.test(message) ? message : 'tenant_provisioning_step_failed';
};

const bindWorkerCallbacksToLockedDeps = (
  lockedDeps: InstanceRegistryServiceDeps,
  workerDeps: InstanceRegistryServiceDeps
): InstanceRegistryServiceDeps => ({
  ...lockedDeps,
  publishTenantIngress: workerDeps.publishTenantIngress,
  probeTenantEndpoint: workerDeps.probeTenantEndpoint,
  readProvisioningModuleReadiness: workerDeps.readProvisioningModuleReadiness,
  reconcileTenantIamRoles: workerDeps.reconcileTenantIamRoles,
  probeTenantIamAccess: workerDeps.probeTenantIamAccess,
});

const executeWithLeaseHeartbeat = async <T>(
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  workerId: string,
  execute: (assertLeaseActive: () => void) => Promise<T>
): Promise<T> => {
  let leaseFailure: Error | undefined;
  let stopped = false;
  const renewLease = async (): Promise<void> => {
    const renewed = await deps.repository.renewProvisioningRunLease({
      runId: run.id,
      leaseOwner: workerId,
      leaseExpiresAt: new Date(Date.now() + LEASE_MILLISECONDS).toISOString(),
    });
    if (!renewed) throw new Error('provisioning_claim_lost');
  };
  await renewLease();
  let renewal: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (renewal) return;
    renewal = renewLease()
      .catch((error) => {
        if (stopped) return;
        leaseFailure = new Error('provisioning_claim_lost');
        logger.warn('tenant_provisioning_lease_heartbeat_failed', {
          operation: 'create_instance',
          instance_id: run.instanceId,
          run_id: run.id,
          error_code: errorCode(error),
        });
      })
      .finally(() => {
        renewal = undefined;
      });
  }, LEASE_HEARTBEAT_MILLISECONDS);
  timer.unref();
  const assertLeaseActive = () => {
    if (leaseFailure) throw leaseFailure;
  };
  try {
    return await execute(assertLeaseActive);
  } finally {
    stopped = true;
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
    terminalEvidence: {
      failedStep: stepKey,
      errorCode: code,
      deadlineAt: run.deadlineAt,
      elapsedMs: Math.max(0, now.getTime() - new Date(run.createdAt).getTime()),
    },
    completedAt: now.toISOString(),
  });
};

export const processNextTenantProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  input: { readonly workerId: string; readonly now?: Date }
): Promise<InstanceProvisioningRun | null> => {
  const currentTime = () => input.now ?? new Date();
  const now = currentTime();
  const run = await deps.repository.claimNextProvisioningRun({
    workerId: input.workerId,
    leaseExpiresAt: new Date(now.getTime() + LEASE_MILLISECONDS).toISOString(),
    parentDomain: KASSEL_PARENT_DOMAIN,
  });
  if (!run) return null;
  const execute = async (
    lockedDeps: InstanceRegistryServiceDeps,
    assertLeaseActive: () => void
  ) => {
    const current = (await lockedDeps.repository.listProvisioningRuns(run.instanceId)).find(
      (candidate) => candidate.id === run.id && candidate.leaseOwner === input.workerId
    );
    if (!current) return null;
    const instance = await lockedDeps.repository.getInstanceById(run.instanceId);
    const assertExecutionActive = () => {
      assertLeaseActive();
      if (currentTime().getTime() >= new Date(current.deadlineAt).getTime()) {
        throw new Error('provisioning_deadline_exceeded');
      }
    };
    let failurePhase: TenantProvisioningFailurePhase = 'execution_guard';
    try {
      assertExecutionActive();
      failurePhase = 'instance_validation';
      if (!instance) throw new Error('instance_not_found');
      if (!['requested', 'validated', 'provisioning'].includes(instance.status)) {
        throw new Error('provisioning_instance_status_invalid');
      }
      failurePhase = 'snapshot_validation';
      assertTenantProvisioningSnapshotCurrent(current, instance);
      failurePhase = 'step_execution';
      return await runTenantProvisioningStep({
        deps: lockedDeps,
        run: current,
        instance,
        workerId: input.workerId,
        now: currentTime(),
        assertExecutionActive,
      });
    } catch (error) {
      const code = errorCode(error);
      if (code === 'provisioning_claim_lost') throw error;
      const stepKey = code === 'provisioning_step_invalid' ? 'registry' : readStep(current);
      try {
        logger.warn('tenant_provisioning_step_exception', {
          operation: 'create_instance',
          result: 'failed',
          request_id: current.requestId,
          instance_id: current.instanceId,
          run_id: current.id,
          step_key: stepKey,
          failure_phase: failurePhase,
          error_type: readDiagnosticErrorType(error),
          error_code: code,
          classification: code,
          ...buildProvisioningFailureDiagnostics(error),
        });
      } catch {
        // Diagnostic logging must never replace the provisioning failure.
      }
      const failureTime = currentTime();
      const terminal =
        isTerminalError(error) || failureTime.getTime() >= new Date(current.deadlineAt).getTime();
      if (terminal) {
        return failRun(lockedDeps, current, input.workerId, stepKey, error, failureTime);
      }
      logger.warn('tenant_provisioning_retry_scheduled', {
        operation: 'create_instance',
        instance_id: current.instanceId,
        run_id: current.id,
        step_key: stepKey,
        error_code: code,
      });
      return updateClaimedRun(lockedDeps, current, input.workerId, {
        stepKey,
        nextAttemptAt: new Date(failureTime.getTime() + RETRY_MILLISECONDS).toISOString(),
        errorCode: code,
        errorMessage: 'Provisionierung wird erneut versucht.',
      });
    }
  };
  const withInstanceProvisioningLock = requireDependency(
    deps.withInstanceProvisioningLock,
    'dependency_missing_withInstanceProvisioningLock'
  );
  return withInstanceProvisioningLock(run.instanceId, (lockedDeps) =>
    executeWithLeaseHeartbeat(deps, run, input.workerId, (assertLeaseActive) =>
      execute(bindWorkerCallbacksToLockedDeps(lockedDeps, deps), assertLeaseActive)
    )
  );
};
