import type { InstanceProvisioningRun, InstanceRegistryRecord, InstanceStatus } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { createExecuteKeycloakProvisioningHandler } from './service-keycloak-execution.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({
  component: 'iam-instance-registry-tenant-provisioning',
  level: 'info',
});

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const LEASE_MILLISECONDS = 30_000;
const RETRY_MILLISECONDS = 5_000;

type ParentStep =
  | 'registry'
  | 'keycloak'
  | 'lifecycle'
  | 'ingress'
  | 'tls'
  | 'activate'
  | 'login'
  | 'module_readiness'
  | 'completed';

const parentSteps = new Set<string>([
  'registry',
  'keycloak',
  'lifecycle',
  'ingress',
  'tls',
  'activate',
  'login',
  'module_readiness',
  'completed',
]);

const readStep = (run: InstanceProvisioningRun): ParentStep =>
  run.stepKey && parentSteps.has(run.stepKey) ? (run.stepKey as ParentStep) : 'registry';

const requireDependency = <T>(value: T | undefined, code: string): T => {
  if (!value) throw new Error(code);
  return value;
};

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
  return /^[a-z][a-z0-9_:-]{2,100}$/u.test(message)
    ? message
    : 'tenant_provisioning_step_failed';
};

const updateClaimedRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  workerId: string,
  input: {
    status?: InstanceStatus;
    stepKey: ParentStep;
    childKeycloakRunId?: string;
    nextAttemptAt?: string;
    errorCode?: string;
    errorMessage?: string;
    terminalEvidence?: Readonly<Record<string, unknown>>;
    completedAt?: string;
  }
): Promise<InstanceProvisioningRun> => {
  const updated = await deps.repository.updateProvisioningRun({
    runId: run.id,
    leaseOwner: workerId,
    status: input.status ?? 'provisioning',
    stepKey: input.stepKey,
    childKeycloakRunId: input.childKeycloakRunId,
    nextAttemptAt: input.nextAttemptAt,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    terminalEvidence: input.terminalEvidence,
    completedAt: input.completedAt,
  });
  if (!updated) throw new Error('provisioning_claim_lost');
  return updated;
};

const continueAt = (
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  workerId: string,
  stepKey: ParentStep,
  now: Date,
  input: {
    childKeycloakRunId?: string;
    terminalEvidence?: Readonly<Record<string, unknown>>;
    delayMs?: number;
  } = {}
) =>
  updateClaimedRun(deps, run, workerId, {
    stepKey,
    childKeycloakRunId: input.childKeycloakRunId,
    terminalEvidence: input.terminalEvidence,
    nextAttemptAt: new Date(now.getTime() + (input.delayMs ?? 0)).toISOString(),
  });

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

const runStep = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun,
  instance: InstanceRegistryRecord,
  workerId: string,
  now: Date
): Promise<InstanceProvisioningRun> => {
  const step = readStep(run);
  switch (step) {
    case 'registry': {
      const provisioning = await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'provisioning',
        actorId: run.actorId,
        requestId: run.requestId,
      });
      if (!provisioning) throw new Error('instance_not_found');
      const child = await createExecuteKeycloakProvisioningHandler(deps)({
        instanceId: instance.instanceId,
        intent: 'provision',
        idempotencyKey: `parent:${run.id}:keycloak:${run.deadlineAt}`,
        actorId: run.actorId,
        requestId: run.requestId,
      });
      if (!child) throw new Error('instance_not_found');
      return continueAt(deps, run, workerId, 'keycloak', now, {
        childKeycloakRunId: child.id,
        delayMs: RETRY_MILLISECONDS,
      });
    }
    case 'keycloak': {
      if (!run.childKeycloakRunId) throw new Error('keycloak_child_run_missing');
      const child = await deps.repository.getKeycloakProvisioningRun(
        instance.instanceId,
        run.childKeycloakRunId
      );
      if (!child) throw new Error('keycloak_child_run_missing');
      if (child.overallStatus === 'failed') throw new Error('keycloak_provisioning_failed');
      return continueAt(deps, run, workerId, child.overallStatus === 'succeeded' ? 'lifecycle' : 'keycloak', now, {
        delayMs: child.overallStatus === 'succeeded' ? 0 : RETRY_MILLISECONDS,
      });
    }
    case 'lifecycle': {
      await requireDependency(
        deps.scheduleProvisioningModuleReconcile,
        'dependency_missing_scheduleProvisioningModuleReconcile'
      )(instance.instanceId);
      return continueAt(deps, run, workerId, 'ingress', now);
    }
    case 'ingress': {
      const evidence = await requireDependency(
        deps.publishTenantIngress,
        'dependency_missing_publishTenantIngress'
      )({
        instanceId: instance.instanceId,
        primaryHostname: instance.primaryHostname,
      });
      return continueAt(deps, run, workerId, 'tls', now, { terminalEvidence: evidence });
    }
    case 'tls': {
      const authIssuerUrl = instance.authIssuerUrl;
      if (!authIssuerUrl) throw new Error('kassel_auth_issuer_missing');
      const evidence = await requireDependency(
        deps.probeTenantEndpoint,
        'dependency_missing_probeTenantEndpoint'
      )({
        kind: 'ingress',
        primaryHostname: instance.primaryHostname,
        authIssuerUrl,
        authClientId: instance.authClientId,
      });
      return continueAt(deps, run, workerId, 'module_readiness', now, {
        terminalEvidence: evidence,
      });
    }
    case 'login': {
      const authIssuerUrl = instance.authIssuerUrl;
      if (!authIssuerUrl) throw new Error('kassel_auth_issuer_missing');
      const evidence = await requireDependency(
        deps.probeTenantEndpoint,
        'dependency_missing_probeTenantEndpoint'
      )({
        kind: 'login',
        primaryHostname: instance.primaryHostname,
        authIssuerUrl,
        authClientId: instance.authClientId,
      });
      return continueAt(deps, run, workerId, 'activate', now, {
        terminalEvidence: evidence,
      });
    }
    case 'module_readiness': {
      const readiness = await requireDependency(
        deps.readProvisioningModuleReadiness,
        'dependency_missing_readProvisioningModuleReadiness'
      )(instance.instanceId);
      if (readiness.status === 'blocked') throw new Error('module_readiness_blocked');
      if (readiness.status === 'pending') {
        return continueAt(deps, run, workerId, 'module_readiness', now, {
          terminalEvidence: readiness.evidence,
          delayMs: RETRY_MILLISECONDS,
        });
      }
      return continueAt(deps, run, workerId, 'login', now, {
        terminalEvidence: readiness.evidence,
      });
    }
    case 'activate': {
      const activated = await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'active',
        actorId: run.actorId,
        requestId: run.requestId,
      });
      if (!activated) throw new Error('instance_not_found');
      return updateClaimedRun(deps, run, workerId, {
        status: 'active',
        stepKey: 'completed',
        completedAt: now.toISOString(),
      });
    }
    case 'completed':
      return run;
  }
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
      return await runStep(lockedDeps, current, instance, input.workerId, now);
    } catch (error) {
      const terminal = isTerminalError(error) || now.getTime() >= new Date(current.deadlineAt).getTime();
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
