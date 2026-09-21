import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import {
  createGetKeycloakPreflightHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak-readers.js';
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
import { tenantIamAccessStep, tenantIamRolesStep } from './tenant-provisioning-iam-steps.js';
import { buildProvisioningFailureDiagnostics, readDiagnosticErrorType } from './observability.js';
import { reconcileProvisioningModuleActivationPolicies } from './service-module-activation.js';
import { syncProtectedSystemAdminPermissions } from './service-module-mutations.js';

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

const readDiagnosticString = (value: unknown, key: string): string | undefined => {
  const candidate = readProperty(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
};

const readDiagnosticErrorCode = (error: unknown): string => {
  const code = readDiagnosticString(error, 'code');
  if (code && /^[A-Za-z0-9_:-]{2,100}$/u.test(code)) return code;
  const message = readDiagnosticString(error, 'message');
  return message && /^[a-z][a-z0-9_:-]{2,100}$/u.test(message)
    ? message
    : INGRESS_FAILURE_CLASSIFICATION;
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
  await syncProtectedSystemAdminPermissions(deps, instance.instanceId);
  assertExecutionActive();
  const pluginSnapshot = readTenantProvisioningPluginSnapshot(run);
  const executionDeps = {
    ...deps,
    readPluginOidcClientRequirements: () => pluginSnapshot.oidcClients,
  };
  const plan = await createPlanKeycloakProvisioningHandler(executionDeps)(instance.instanceId);
  if (!plan) {
    throw new Error('keycloak_plan_blocked');
  }
  if (plan.overallStatus === 'blocked') {
    const preflight = await createGetKeycloakPreflightHandler(executionDeps)(instance.instanceId);
    const blockers = preflight?.checks.filter(({ status }) => status === 'blocked') ?? [];
    const missingTenantSecret =
      instance.realmMode === 'existing' &&
      blockers.length > 0 &&
      blockers.every(({ checkKey }) => checkKey === 'tenant_secret');
    if (!missingTenantSecret) throw new Error('keycloak_plan_blocked');
    return updateClaimedRun(deps, run, workerId, {
      status: 'validated',
      stepKey: 'registry',
      clearChildKeycloakRunId: true,
      terminalEvidence: {
        keycloakPlanGate: {
          status: 'awaiting_tenant_secret',
          planFingerprint: plan.fingerprint,
          intent: 'rotate_client_secret',
          checkedAt: now.toISOString(),
        },
      },
    });
  }
  return updateClaimedRun(deps, run, workerId, {
    status: 'validated',
    stepKey: 'registry',
    clearChildKeycloakRunId: true,
    terminalEvidence: {
      keycloakPlanGate: {
        status: 'awaiting_plan_confirmation',
        planFingerprint: plan.fingerprint,
        intent: 'provision',
        checkedAt: now.toISOString(),
      },
    },
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
  workerId,
  now,
  assertExecutionActive,
}) => {
  assertExecutionActive();
  await reconcileProvisioningModuleActivationPolicies(deps, run);
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
        ...buildProvisioningFailureDiagnostics(error, { includeNodeSystemFields: true }),
      });
    } catch {
      // Diagnostic logging must never replace the provisioning failure.
    }
    if (readDiagnosticErrorType(error) === 'TypeError') {
      throw Object.assign(new Error('tenant_ingress_publish_invalid'), { cause: error });
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
    let evidence: Awaited<ReturnType<NonNullable<typeof deps.probeTenantEndpoint>>>;
    try {
      evidence = await requireDependency(
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
    } catch (error) {
      if (readDiagnosticErrorType(error) === 'TypeError') {
        throw Object.assign(
          new Error(
            kind === 'ingress' ? 'tenant_ingress_probe_invalid' : 'tenant_login_probe_invalid'
          ),
          { cause: error }
        );
      }
      throw error;
    }
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
  let readiness: Awaited<ReturnType<NonNullable<typeof deps.readProvisioningModuleReadiness>>>;
  try {
    readiness = await requireDependency(
      deps.readProvisioningModuleReadiness,
      'dependency_missing_readProvisioningModuleReadiness'
    )({
      instanceId: instance.instanceId,
      lifecycles: readTenantProvisioningPluginSnapshot(run).lifecycles,
    });
  } catch (error) {
    if (readDiagnosticErrorType(error) === 'TypeError') {
      throw Object.assign(new Error('module_readiness_probe_invalid'), { cause: error });
    }
    throw error;
  }
  assertExecutionActive();
  if (readiness.status === 'blocked') {
    throw Object.assign(new Error(readiness.errorCode ?? 'module_readiness_blocked'), {
      tenantProvisioningTerminal: true,
    });
  }
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
  if (
    readProperty(run.terminalEvidence.tenantIamRoleReconcile, 'outcome') !== 'success' ||
    readProperty(run.terminalEvidence.tenantIamAccess, 'status') !== 'ready'
  ) {
    return continueAt(deps, run, workerId, 'tenant_iam_roles', now);
  }
  // Technical provisioning must never make a tenant reachable. `validated` is
  // the existing non-traffic lifecycle state from which the explicitly
  // confirmed status action can move to `active`.
  const validated = await deps.repository.setInstanceStatus({
    instanceId: instance.instanceId,
    status: 'validated',
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  if (!validated) throw new Error('instance_not_found');
  return updateClaimedRun(deps, run, workerId, {
    status: 'validated',
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
  login: probeStep('login', 'tenant_iam_roles'),
  tenant_iam_roles: tenantIamRolesStep,
  tenant_iam_access: tenantIamAccessStep,
  activate: activateStep,
  completed: async ({ run }) => run,
};

export const runTenantProvisioningStep = (context: StepContext) =>
  stepHandlers[readStep(context.run)](context);
