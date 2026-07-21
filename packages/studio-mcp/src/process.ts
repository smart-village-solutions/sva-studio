import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { StudioApiError, type StudioApiClient, type StudioApiRequest } from './api-client.js';
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
    && (readAssignedModuleIds(detail).size === 0 || unwrap(moduleIam.overall).status === 'ready');
};

const readAssignedModuleIds = (detail: Record<string, unknown>): ReadonlySet<string> =>
  new Set((Array.isArray(detail.assignedModules) ? detail.assignedModules : []).flatMap((value) => {
    if (typeof value === 'string') return [value];
    const record = unwrap(value);
    return typeof record.moduleId === 'string' ? [record.moduleId] : [];
  }));

const deriveIdempotencyKey = (base: string, suffix: string): string => {
  const candidate = `${base}:${suffix}`;
  return candidate.length <= 200
    ? candidate
    : createHash('sha256').update(candidate).digest('hex');
};

const readRunId = (detail: Record<string, unknown>): string | undefined => {
  const latestRun = unwrap(detail.latestKeycloakProvisioningRun);
  if (typeof latestRun.id === 'string') return latestRun.id;
  const runs = Array.isArray(detail.keycloakProvisioningRuns) ? detail.keycloakProvisioningRuns : [];
  const firstRun = unwrap(runs[0]);
  return typeof firstRun.id === 'string' ? firstRun.id : undefined;
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
  let delayMs = 1_000;
  while (!isTerminalRun(run) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now()))));
    run = unwrap(await request(client, { path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`, requestId }));
    delayMs = Math.min(delayMs * 2, 5_000);
  }
  return run;
};

const assignMissingModules = async (input: {
  client: StudioApiClient;
  basePath: string;
  moduleIds: readonly string[];
  requestId: string;
  idempotencyKey: string;
}): Promise<boolean> => {
  const detail = unwrap(await request(input.client, { path: input.basePath, requestId: input.requestId }));
  const requestedModuleIds = [...new Set(input.moduleIds)];
  const missingModuleIds = requestedModuleIds.filter((moduleId) => !readAssignedModuleIds(detail).has(moduleId));
  for (const moduleId of missingModuleIds) {
    await request(input.client, mutation(`${input.basePath}/modules/assign`, { moduleId }, input.requestId, deriveIdempotencyKey(input.idempotencyKey, `module:${moduleId}`)));
  }
  await request(input.client, mutation(`${input.basePath}/modules/seed-iam-baseline`, {}, input.requestId, deriveIdempotencyKey(input.idempotencyKey, 'iam-baseline')));
  if (requestedModuleIds.length === 0) return false;
  await request(input.client, mutation(`${input.basePath}/modules/bootstrap-admin-structure`, { moduleIds: requestedModuleIds }, input.requestId, deriveIdempotencyKey(input.idempotencyKey, 'admin-bootstrap')));
  return true;
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
    try {
      await request(client, mutation('/api/v1/iam/instances', input.create, requestId, idempotencyKey));
      completedSteps.push('registry_created');
    } catch (caught) {
      if (!(caught instanceof StudioApiError && caught.status === 409)) throw caught;
      completedSteps.push('registry_reused');
    }
  }

  if (await assignMissingModules({ client, basePath, moduleIds: input.moduleIds ?? [], requestId, idempotencyKey })) {
    completedSteps.push('modules_and_iam_ready');
  }

  let runId: string | undefined;
  if (input.mode === 'repair') {
    await request(client, mutation(`${basePath}/keycloak/reconcile`, {}, requestId, deriveIdempotencyKey(idempotencyKey, 'reconcile')));
    runId = readRunId(unwrap(await request(client, { path: basePath, requestId })));
  } else {
    const execute = unwrap(await request(client, mutation(`${basePath}/keycloak/execute`, { intent: 'provision' }, requestId, deriveIdempotencyKey(idempotencyKey, 'provision'))));
    runId = typeof execute.id === 'string' ? execute.id : undefined;
  }
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

  const roleReconcile = unwrap(await request(client, mutation(`${basePath}/tenant-iam/roles/reconcile`, {}, requestId, deriveIdempotencyKey(idempotencyKey, 'roles-reconcile'))));
  if (roleReconcile.outcome !== 'success') {
    return {
      completed: false, status: 'blocked', instanceId: input.instanceId, currentStep: 'tenant_iam_roles_reconcile',
      completedSteps, openSteps: ['tenant_iam_roles_reconcile'], doctor: roleReconcile,
      nextAction: { actionId: 'instance.iam.roles.reconcile', summary: 'Der Rollenabgleich ist nicht vollständig erfolgreich; Ergebnis prüfen.' }, requestId,
    };
  }
  completedSteps.push('tenant_iam_roles_reconciled');
  await request(client, mutation(`${basePath}/tenant-iam/access-probe`, {}, requestId, deriveIdempotencyKey(idempotencyKey, 'access-probe')));
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
