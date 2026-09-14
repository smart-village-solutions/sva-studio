import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';
import { createSdkLogger, redactObject } from '@sva/server-runtime';

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
import { readTenantProvisioningPluginSnapshot } from './tenant-provisioning-snapshot.js';

type StepContext = {
  deps: InstanceRegistryServiceDeps;
  run: InstanceProvisioningRun;
  instance: InstanceRegistryRecord;
  workerId: string;
  now: Date;
  assertExecutionActive: () => void;
};

type StepHandler = (context: StepContext) => Promise<InstanceProvisioningRun>;

const logger = createSdkLogger({
  component: 'iam-instance-registry-tenant-provisioning',
  level: 'info',
});

const readProperty = (value: unknown, key: string): unknown => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
};

const INGRESS_FAILURE_CLASSIFICATION = 'tenant_provisioning_step_failed';
const SAFE_DIAGNOSTIC_ERROR_TYPES = new Set([
  'AggregateError',
  'DatabaseError',
  'Error',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'SystemError',
  'TypeError',
  'URIError',
]);

const readDiagnosticString = (value: unknown, key: string): string | undefined => {
  const candidate = readProperty(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
};

export const readDiagnosticErrorType = (error: unknown): string => {
  const name = readDiagnosticString(error, 'name');
  return name && SAFE_DIAGNOSTIC_ERROR_TYPES.has(name) ? name : typeof error;
};

const readDiagnosticErrorCode = (error: unknown): string => {
  const code = readDiagnosticString(error, 'code');
  if (code && /^[A-Za-z0-9_:-]{2,100}$/u.test(code)) return code;
  const message = readDiagnosticString(error, 'message');
  return message && /^[a-z][a-z0-9_:-]{2,100}$/u.test(message)
    ? message
    : INGRESS_FAILURE_CLASSIFICATION;
};

export const buildProvisioningFailureDiagnostics = (
  error: unknown
): Readonly<Record<string, unknown>> => {
  const code = readDiagnosticString(error, 'code');
  const postgresDiagnosticKeys = ['severity', 'schema', 'table', 'column', 'constraint', 'routine'];
  const isPostgresError =
    Boolean(code && /^[0-9A-Z]{5}$/u.test(code)) &&
    postgresDiagnosticKeys.some((key) => readDiagnosticString(error, key) !== undefined);
  if (isPostgresError) {
    return redactObject({
      diagnostic_error: {
        name: readDiagnosticErrorType(error),
        code,
        table: readDiagnosticString(error, 'table'),
        column: readDiagnosticString(error, 'column'),
        constraint: readDiagnosticString(error, 'constraint'),
      },
    });
  }
  const syscall = readDiagnosticString(error, 'syscall');
  const isNodeSystemError = Boolean(code && /^E[A-Z0-9_]{1,99}$/u.test(code) && syscall);
  if (isNodeSystemError) {
    return redactObject({
      diagnostic_error: {
        name: readDiagnosticErrorType(error),
        code,
        syscall,
        path: readDiagnosticString(error, 'path'),
        dest: readDiagnosticString(error, 'dest'),
      },
    });
  }
  return redactObject({
    diagnostic_error: {
      name: readDiagnosticErrorType(error),
    },
  });
};

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
  const pluginSnapshot = readTenantProvisioningPluginSnapshot(run);
  const child = await createExecuteKeycloakProvisioningHandler(
    { ...deps, readPluginOidcClientRequirements: () => pluginSnapshot.oidcClients },
    {
      allowActiveTenantProvisioning: true,
    }
  )({
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

const lifecycleStep: StepHandler = async ({ deps, run, workerId, now, assertExecutionActive }) => {
  assertExecutionActive();
  readTenantProvisioningPluginSnapshot(run);
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
  const publishTenantIngress = requireDependency(
    deps.publishTenantIngress,
    'dependency_missing_publishTenantIngress'
  );
  let evidence: Awaited<ReturnType<typeof publishTenantIngress>>;
  try {
    evidence = await publishTenantIngress({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
    });
  } catch (error) {
    try {
      logger.warn('tenant_ingress_publish_failed', {
        operation: 'publish_tenant_ingress',
        result: 'failed',
        request_id: run.requestId,
        instance_id: instance.instanceId,
        primary_hostname: instance.primaryHostname,
        run_id: run.id,
        step_key: 'ingress',
        error_type: readDiagnosticErrorType(error),
        error_code: readDiagnosticErrorCode(error),
        classification: INGRESS_FAILURE_CLASSIFICATION,
        ...buildProvisioningFailureDiagnostics(error),
      });
    } catch {
      // Diagnostic logging must never replace the provisioning failure.
    }
    throw error;
  }
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
  )({
    instanceId: instance.instanceId,
    lifecycles: readTenantProvisioningPluginSnapshot(run).lifecycles,
  });
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
