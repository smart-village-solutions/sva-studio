import type { InstanceProvisioningRun, InstanceStatus } from '@sva/core';

import type { InstanceRegistryServiceDeps } from './service-types.js';

export const RETRY_MILLISECONDS = 5_000;

export type ParentStep =
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

export const readStep = (run: InstanceProvisioningRun): ParentStep => {
  if (!run.stepKey) return 'registry';
  if (!parentSteps.has(run.stepKey)) throw new Error('provisioning_step_invalid');
  return run.stepKey as ParentStep;
};

export const requireDependency = <T>(value: T | undefined, code: string): T => {
  if (!value) throw new Error(code);
  return value;
};

export const updateClaimedRun = async (
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

export const continueAt = (
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
