import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { StudioApiClient, StudioApiRequest } from './api-client.js';
import type { schemas } from './contracts.js';

type ProcessInput = z.infer<typeof schemas.process>;

export type StudioInstanceProcessResult = {
  readonly completed: boolean;
  readonly status: 'completed' | 'awaiting_human_action' | 'blocked' | 'in_progress';
  readonly instanceId: string;
  readonly currentStep: string;
  readonly completedSteps: readonly string[];
  readonly openSteps: readonly string[];
  readonly doctor: unknown;
  readonly nextAction: { readonly actionId: string; readonly summary: string };
  readonly requestId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const unwrap = (value: unknown): Record<string, unknown> =>
  isRecord(value) && isRecord(value.data) ? value.data : isRecord(value) ? value : {};

const isTerminalRun = (value: Record<string, unknown>): boolean =>
  value.overallStatus === 'succeeded' || value.overallStatus === 'failed';

const isDoctorReady = (detail: Record<string, unknown>): boolean => {
  const tenantIam = unwrap(detail.tenantIamStatus);
  const moduleIam = unwrap(detail.moduleIamStatus);
  const status = unwrap(detail.keycloakStatus);
  return status.realmExists === true
    && status.clientExists === true
    && tenantIam.overall !== undefined
    && unwrap(tenantIam.overall).status === 'ready'
    && (moduleIam.overall === undefined || unwrap(moduleIam.overall).status === 'ready');
};

const request = (client: StudioApiClient, input: StudioApiRequest) => client.request(input);

const mutation = (path: string, body: unknown, requestId: string, idempotencyKey: string): StudioApiRequest => ({
  method: 'POST', path, body, requestId, idempotencyKey,
});

const waitForRun = async (
  client: StudioApiClient,
  instanceId: string,
  runId: string,
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  let run = unwrap(await request(client, { path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`, requestId }));
  while (!isTerminalRun(run) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    run = unwrap(await request(client, { path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`, requestId }));
  }
  return run;
};

export const runStudioInstanceProcess = async (
  client: StudioApiClient,
  input: ProcessInput,
  options: { readonly timeoutMs: number }
): Promise<StudioInstanceProcessResult> => {
  const requestId = randomUUID();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const basePath = `/api/v1/iam/instances/${encodeURIComponent(input.instanceId)}`;
  const completedSteps: string[] = [];
  const openSteps: string[] = [];

  if (input.mode === 'create') {
    await request(client, mutation('/api/v1/iam/instances', input.create, requestId, idempotencyKey));
    completedSteps.push('registry_created');
  }

  for (const moduleId of input.moduleIds ?? []) {
    await request(client, mutation(`${basePath}/modules/assign`, { moduleId }, requestId, `${idempotencyKey}:module:${moduleId}`));
  }
  if ((input.moduleIds?.length ?? 0) > 0) {
    await request(client, mutation(`${basePath}/modules/seed-iam-baseline`, {}, requestId, `${idempotencyKey}:iam-baseline`));
    await request(client, mutation(`${basePath}/modules/bootstrap-admin-structure`, { moduleIds: input.moduleIds }, requestId, `${idempotencyKey}:admin-bootstrap`));
    completedSteps.push('modules_and_iam_ready');
  }

  const execute = unwrap(await request(client, mutation(`${basePath}/keycloak/execute`, { intent: 'provision' }, requestId, `${idempotencyKey}:provision`)));
  const runId = typeof execute.id === 'string' ? execute.id : undefined;
  if (!runId) {
    return {
      completed: false, status: 'blocked', instanceId: input.instanceId, currentStep: 'keycloak_provisioning',
      completedSteps, openSteps: ['keycloak_provisioning'], doctor: null,
      nextAction: { actionId: 'instance.provision.run.read', summary: 'Der Provisioning-Lauf wurde nicht eindeutig zurückgegeben.' }, requestId,
    };
  }
  const run = await waitForRun(client, input.instanceId, runId, requestId, options.timeoutMs);
  if (run.overallStatus !== 'succeeded') {
    return {
      completed: false, status: run.overallStatus === 'failed' ? 'blocked' : 'in_progress', instanceId: input.instanceId,
      currentStep: 'keycloak_provisioning', completedSteps, openSteps: ['keycloak_provisioning'], doctor: run,
      nextAction: { actionId: 'instance.provision.run.read', summary: 'Den Provisioning-Lauf prüfen und erst dann eine gezielte Folgeaktion ausführen.' }, requestId,
    };
  }
  completedSteps.push('keycloak_provisioned');

  await request(client, mutation(`${basePath}/tenant-iam/access-probe`, {}, requestId, `${idempotencyKey}:access-probe`));
  completedSteps.push('tenant_iam_access_probed');
  const detail = unwrap(await request(client, { path: basePath, requestId }));
  const doctor = {
    keycloakStatus: detail.keycloakStatus,
    tenantIamStatus: detail.tenantIamStatus,
    moduleIamStatus: detail.moduleIamStatus,
  };
  if (detail.status !== 'active') {
    return {
      completed: false, status: 'awaiting_human_action', instanceId: input.instanceId, currentStep: 'activation',
      completedSteps, openSteps: ['activation'], doctor,
      nextAction: { actionId: 'instance.status.activate', summary: 'Die technische Abnahme ist abgeschlossen; Aktivierung verlangt eine serverseitige Bestätigungs-Challenge.' }, requestId,
    };
  }
  if (!isDoctorReady(detail)) {
    return {
      completed: false, status: 'blocked', instanceId: input.instanceId, currentStep: 'doctor_validation',
      completedSteps, openSteps: ['doctor_validation'], doctor,
      nextAction: { actionId: 'instance.diagnose', summary: 'Die aktuelle Doctor-Abnahme ist nicht vollständig bereit.' }, requestId,
    };
  }
  return {
    completed: true, status: 'completed', instanceId: input.instanceId, currentStep: 'completed', completedSteps,
    openSteps, doctor,
    nextAction: { actionId: 'instance.read', summary: 'Die Instanz ist aktiv und vollständig abgenommen.' }, requestId,
  };
};
