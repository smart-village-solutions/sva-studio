import { StudioApiError, type StudioApiClient } from './api-client.js';
import type { ProcessInput, StudioInstanceProcessResult } from './process.js';
import { deriveIdempotencyKey, mutation, request, waitForRun } from './process-requests.js';
import { readRunId, unwrap } from './process-state.js';
import { completeIam } from './process-iam.js';

export type ProcessContext = {
  readonly client: StudioApiClient;
  readonly input: ProcessInput;
  readonly basePath: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly completedSteps: string[];
  readonly timeoutMs: number;
  currentStep: string;
};

type ProcessStage = { readonly runId: string } | { readonly result: StudioInstanceProcessResult };

const prepareRun = async (context: ProcessContext): Promise<ProcessStage> => {
  const { client, input, basePath, requestId, idempotencyKey, completedSteps } = context;
  let runId = input.keycloakRunId;
  if (!runId) {
    context.currentStep = 'keycloak_plan';
    const plan = unwrap(await request(client, mutation(
      `${basePath}/keycloak/plan`, {}, requestId, deriveIdempotencyKey(idempotencyKey, 'plan')
    )));
    const planFingerprint = typeof plan.fingerprint === 'string' ? plan.fingerprint : undefined;
    if (!input.planFingerprint) {
      return { result: {
        completed: false, status: 'awaiting_human_action', instanceId: input.instanceId,
        currentStep: 'keycloak_plan_confirmation', completedSteps,
        openSteps: ['keycloak_plan_confirmation', 'keycloak_provisioning'],
        doctor: { keycloakPlan: plan },
        nextAction: {
          actionId: 'instance.keycloak.plan.confirm',
          summary: 'Den aktuellen Keycloak-Plan prüfen und seinen Fingerprint ausdrücklich bestätigen.',
        }, requestId, idempotencyKey,
      } };
    }
    if (planFingerprint !== input.planFingerprint) {
      throw new StudioApiError(409, {
        error: {
          code: 'keycloak_plan_fingerprint_stale',
          message: 'Der bestätigte Keycloak-Plan ist nicht mehr aktuell.',
        },
      }, requestId, idempotencyKey);
    }
    context.currentStep = 'keycloak_provisioning';
    if (input.mode === 'repair') {
      await request(client, mutation(
        `${basePath}/keycloak/reconcile`, { planFingerprint: input.planFingerprint },
        requestId, deriveIdempotencyKey(idempotencyKey, 'reconcile')
      ));
      runId = readRunId(unwrap(await request(client, { path: basePath, requestId })));
    } else {
      const execute = unwrap(await request(client, mutation(
        `${basePath}/keycloak/execute`,
        { intent: 'provision', planFingerprint: input.planFingerprint },
        requestId, deriveIdempotencyKey(idempotencyKey, 'provision')
      )));
      runId = typeof execute.id === 'string' ? execute.id : undefined;
    }
  }
  if (!runId) {
    return { result: {
      completed: false, status: 'blocked', instanceId: input.instanceId,
      currentStep: 'keycloak_provisioning', completedSteps, openSteps: ['keycloak_provisioning'],
      doctor: null,
      nextAction: {
        actionId: 'instance.provision.run.read',
        summary: 'Der Provisioning-Lauf wurde nicht eindeutig zurückgegeben.',
      }, requestId, idempotencyKey,
    } };
  }
  return { runId };
};

const pollRun = async (
  context: ProcessContext, runId: string
): Promise<{ readonly result: StudioInstanceProcessResult } | { readonly run: Record<string, unknown> }> => {
  const { client, input, requestId, idempotencyKey, completedSteps, timeoutMs } = context;
  context.currentStep = 'keycloak_provisioning';
  const run = await waitForRun(client, input.instanceId, runId, requestId, timeoutMs);
  if (run.overallStatus !== 'succeeded') {
    return { result: {
      completed: false, status: run.overallStatus === 'failed' ? 'blocked' : 'in_progress',
      instanceId: input.instanceId, currentStep: 'keycloak_provisioning', completedSteps,
      openSteps: ['keycloak_provisioning'], doctor: run,
      nextAction: {
        actionId: 'instance.provision.run.read',
        summary: 'Den Provisioning-Lauf prüfen und erst dann eine gezielte Folgeaktion ausführen.',
      }, idempotencyKey, requestId,
    } };
  }
  completedSteps.push('keycloak_provisioned');
  return { run };
};

export const runKeycloakPhase = async (context: ProcessContext): Promise<StudioInstanceProcessResult> => {
  const prepared = await prepareRun(context);
  if ('result' in prepared) return prepared.result;
  const polled = await pollRun(context, prepared.runId);
  if ('result' in polled) return polled.result;
  return completeIam(context, polled.run);
};
