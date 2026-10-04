import { StudioApiError, type StudioApiClient } from './api-client.js';
import type { ProcessInput, StudioInstanceProcessResult } from './process.js';
import {
  deriveIdempotencyKey,
  mutation,
  request,
  waitForParentProvisioning,
} from './process-requests.js';
import { evaluateDoctor, readParentRun, readProvisioningAction, unwrap } from './process-state.js';

type ParentProcessInput = {
  client: StudioApiClient;
  input: ProcessInput;
  basePath: string;
  automatedParentRunId: string;
  requestId: string;
  idempotencyKey: string;
  completedSteps: string[];
  timeoutMs: number;
};

const blockedParentRun = (
  context: ParentProcessInput,
  parentRun: Record<string, unknown>,
  action: unknown
): StudioInstanceProcessResult => ({
  completed: false,
  status: 'blocked',
  instanceId: context.input.instanceId,
  currentStep: 'parent_provisioning',
  completedSteps: context.completedSteps,
  openSteps: ['parent_provisioning'],
  doctor: parentRun,
  nextAction: {
    actionId: typeof action === 'string' ? action : 'instance.diagnose',
    summary: 'Den fehlgeschlagenen Provisioning-Lauf und die nächste Aktion prüfen.',
  },
  requestId: context.requestId,
  idempotencyKey: context.idempotencyKey,
});

const pendingSecret = (
  context: ParentProcessInput,
  detail: Record<string, unknown>,
  parentRun: Record<string, unknown>
): StudioInstanceProcessResult => ({
  completed: false,
  status: 'awaiting_human_action',
  instanceId: context.input.instanceId,
  currentStep: 'tenant_secret',
  completedSteps: context.completedSteps,
  openSteps: ['tenant_secret', 'keycloak_plan_confirmation'],
  doctor: {
    parentRun,
    keycloakPlan: detail.keycloakPlan,
    provisioningReadiness: detail.provisioningReadiness,
  },
  nextAction: {
    actionId: 'instance.secret.rotate',
    summary: 'Das Tenant-Secret geschützt erfassen; derselbe Parent-Run wird danach fortgesetzt.',
  },
  requestId: context.requestId,
  idempotencyKey: context.idempotencyKey,
});

const pendingPlanConfirmation = (
  context: ParentProcessInput,
  parentRun: Record<string, unknown>,
  plan: Record<string, unknown>
): StudioInstanceProcessResult => ({
  completed: false,
  status: 'awaiting_human_action',
  instanceId: context.input.instanceId,
  currentStep: 'keycloak_plan_confirmation',
  completedSteps: context.completedSteps,
  openSteps: ['keycloak_plan_confirmation', 'parent_provisioning'],
  doctor: { parentRun, keycloakPlan: plan },
  nextAction: {
    actionId: 'instance.keycloak.plan.confirm',
    summary: 'Den aktuellen Keycloak-Plan prüfen und seinen Fingerprint ausdrücklich bestätigen.',
  },
  requestId: context.requestId,
  idempotencyKey: context.idempotencyKey,
});

const executeConfirmedParentPlan = async (
  context: ParentProcessInput,
  detail: Record<string, unknown>,
  parentRun: Record<string, unknown>
): Promise<{ detail: Record<string, unknown>; pending?: StudioInstanceProcessResult }> => {
  const plan = unwrap(detail.keycloakPlan);
  const planFingerprint = typeof plan.fingerprint === 'string' ? plan.fingerprint : undefined;
  if (!context.input.planFingerprint) {
    return { detail, pending: pendingPlanConfirmation(context, parentRun, plan) };
  }
  if (planFingerprint !== context.input.planFingerprint) {
    throw new StudioApiError(
      409,
      {
        error: {
          code: 'keycloak_plan_fingerprint_stale',
          message: 'Der bestätigte Keycloak-Plan ist nicht mehr aktuell.',
        },
      },
      context.requestId,
      context.idempotencyKey
    );
  }
  await request(
    context.client,
    mutation(
      `${context.basePath}/keycloak/execute`,
      { intent: 'provision', planFingerprint: context.input.planFingerprint },
      context.requestId,
      deriveIdempotencyKey(context.idempotencyKey, 'parent-provision')
    )
  );
  return {
    detail: await waitForParentProvisioning(
      context.client,
      context.basePath,
      context.automatedParentRunId,
      context.requestId,
      context.timeoutMs
    ),
  };
};

const finishParentProvisioning = (
  context: ParentProcessInput,
  detail: Record<string, unknown>,
  parentRun: Record<string, unknown>
): StudioInstanceProcessResult => {
  if (parentRun.status === 'failed') {
    return blockedParentRun(context, parentRun, readProvisioningAction(detail));
  }
  if (parentRun.completedAt === undefined) {
    return {
      completed: false,
      status: 'in_progress',
      instanceId: context.input.instanceId,
      currentStep: 'parent_provisioning',
      completedSteps: context.completedSteps,
      openSteps: ['parent_provisioning'],
      doctor: parentRun,
      nextAction: {
        actionId: 'instance.readiness.refresh',
        summary: 'Der automatische Provisioning-Lauf wird serverseitig weitergeführt.',
      },
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
    };
  }
  context.completedSteps.push('parent_provisioning_completed');
  return evaluateDoctor({
    detail,
    instanceId: context.input.instanceId,
    completedSteps: context.completedSteps,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
  });
};

export const runParentProvisioning = async (
  context: ParentProcessInput
): Promise<StudioInstanceProcessResult> => {
  let detail = await waitForParentProvisioning(
    context.client,
    context.basePath,
    context.automatedParentRunId,
    context.requestId,
    context.timeoutMs
  );
  let parentRun = readParentRun(detail, context.automatedParentRunId);
  if (parentRun.status === 'failed') {
    return blockedParentRun(
      context,
      parentRun,
      unwrap(unwrap(detail.provisioningReadiness).nextAction).action
    );
  }
  const projectedAction = readProvisioningAction(detail);
  if (projectedAction === 'instance.secret.rotate') {
    return pendingSecret(context, detail, parentRun);
  }
  if (projectedAction === 'instance.keycloak.execute') {
    const outcome = await executeConfirmedParentPlan(context, detail, parentRun);
    if (outcome.pending) return outcome.pending;
    detail = outcome.detail;
    parentRun = readParentRun(detail, context.automatedParentRunId);
  }
  return finishParentProvisioning(context, detail, parentRun);
};
