import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';

import { createExecuteKeycloakProvisioningHandler } from './service-keycloak-execution.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  continueAt,
  readStep,
  requireDependency,
  RETRY_MILLISECONDS,
  updateClaimedRun,
} from './tenant-provisioning-state.js';
import type { ParentStep } from './tenant-provisioning-state.js';

type StepContext = {
  deps: InstanceRegistryServiceDeps;
  run: InstanceProvisioningRun;
  instance: InstanceRegistryRecord;
  workerId: string;
  now: Date;
  assertExecutionActive: () => void;
};

type StepHandler = (context: StepContext) => Promise<InstanceProvisioningRun>;

const registryStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  const provisioning = await deps.repository.setInstanceStatus({
    instanceId: instance.instanceId,
    status: 'provisioning',
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  if (!provisioning) throw new Error('instance_not_found');
  const child = await createExecuteKeycloakProvisioningHandler(deps, {
    allowActiveTenantProvisioning: true,
  })({
    instanceId: instance.instanceId,
    intent: 'provision',
    idempotencyKey: `parent:${run.id}:keycloak:${run.deadlineAt}`,
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  if (!child) throw new Error('instance_not_found');
  return continueAt(deps, run, workerId, 'keycloak', now, {
    childKeycloakRunId: child.id,
    delayMs: RETRY_MILLISECONDS,
  });
};

const keycloakStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  if (!run.childKeycloakRunId) throw new Error('keycloak_child_run_missing');
  const child = await deps.repository.getKeycloakProvisioningRun(
    instance.instanceId,
    run.childKeycloakRunId
  );
  assertExecutionActive();
  if (!child) throw new Error('keycloak_child_run_missing');
  if (child.overallStatus === 'failed') throw new Error('keycloak_provisioning_failed');
  const succeeded = child.overallStatus === 'succeeded';
  return continueAt(deps, run, workerId, succeeded ? 'lifecycle' : 'keycloak', now, {
    delayMs: succeeded ? 0 : RETRY_MILLISECONDS,
  });
};

const lifecycleStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  await requireDependency(
    deps.scheduleProvisioningModuleReconcile,
    'dependency_missing_scheduleProvisioningModuleReconcile'
  )(instance.instanceId);
  assertExecutionActive();
  return continueAt(deps, run, workerId, 'ingress', now);
};

const ingressStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  const evidence = await requireDependency(
    deps.publishTenantIngress,
    'dependency_missing_publishTenantIngress'
  )({
    instanceId: instance.instanceId,
    primaryHostname: instance.primaryHostname,
  });
  assertExecutionActive();
  return continueAt(deps, run, workerId, 'tls', now, { terminalEvidence: evidence });
};

const probeStep =
  (kind: 'ingress' | 'login', next: ParentStep): StepHandler =>
  async ({ deps, run, instance, workerId, now, assertExecutionActive }) => {
    assertExecutionActive();
    if (!instance.authIssuerUrl) throw new Error('kassel_auth_issuer_missing');
    const expectedRouterName = run.terminalEvidence.routerName;
    const expectedConfigHash = run.terminalEvidence.configHash;
    if (typeof expectedRouterName !== 'string' || typeof expectedConfigHash !== 'string') {
      throw new Error('kassel_ingress_evidence_missing');
    }
    const evidence = await requireDependency(
      deps.probeTenantEndpoint,
      'dependency_missing_probeTenantEndpoint'
    )({
      kind,
      primaryHostname: instance.primaryHostname,
      authIssuerUrl: instance.authIssuerUrl,
      authClientId: instance.authClientId,
      expectedRouterName,
      expectedConfigHash,
    });
    assertExecutionActive();
    return continueAt(deps, run, workerId, next, now, { terminalEvidence: evidence });
  };

const moduleReadinessStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  const readiness = await requireDependency(
    deps.readProvisioningModuleReadiness,
    'dependency_missing_readProvisioningModuleReadiness'
  )(instance.instanceId);
  assertExecutionActive();
  if (readiness.status === 'blocked') throw new Error('module_readiness_blocked');
  const pending = readiness.status === 'pending';
  return continueAt(deps, run, workerId, pending ? 'module_readiness' : 'login', now, {
    terminalEvidence: readiness.evidence,
    delayMs: pending ? RETRY_MILLISECONDS : 0,
  });
};

const activateStep: StepHandler = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  const activated = await deps.repository.setInstanceStatus({
    instanceId: instance.instanceId,
    status: 'active',
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  if (!activated) throw new Error('instance_not_found');
  return updateClaimedRun(deps, run, workerId, {
    status: 'active',
    stepKey: 'completed',
    completedAt: now.toISOString(),
  });
};

const stepHandlers: Record<ParentStep, StepHandler> = {
  registry: registryStep,
  keycloak: keycloakStep,
  lifecycle: lifecycleStep,
  ingress: ingressStep,
  tls: probeStep('ingress', 'module_readiness'),
  module_readiness: moduleReadinessStep,
  login: probeStep('login', 'activate'),
  activate: activateStep,
  completed: async ({ run }) => run,
};

export const runTenantProvisioningStep = (context: StepContext) =>
  stepHandlers[readStep(context.run)](context);
