import { createHash } from 'node:crypto';
import type { StudioApiClient, StudioApiRequest } from './api-client.js';
import {
  isTerminalRun,
  readAssignedModuleIds,
  readParentRun,
  readProvisioningAction,
  unwrap,
} from './process-state.js';

export const deriveIdempotencyKey = (base: string, suffix: string): string => {
  const candidate = `${base}:${suffix}`;
  return candidate.length <= 200 ? candidate : createHash('sha256').update(candidate).digest('hex');
};

export const request = (client: StudioApiClient, input: StudioApiRequest) => client.request(input);

export const mutation = (
  path: string,
  body: unknown,
  requestId: string,
  idempotencyKey: string
): StudioApiRequest => ({
  method: 'POST',
  path,
  body,
  requestId,
  idempotencyKey,
});

export const waitForRun = async (
  client: StudioApiClient,
  instanceId: string,
  runId: string,
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  let run = unwrap(
    await request(client, {
      path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`,
      requestId,
    })
  );
  let delayMs = 1_000;
  while (!isTerminalRun(run) && Date.now() < deadline) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now())))
    );
    run = unwrap(
      await request(client, {
        path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`,
        requestId,
      })
    );
    delayMs = Math.min(delayMs * 2, 5_000);
  }
  return run;
};

export const waitForParentProvisioning = async (
  client: StudioApiClient,
  basePath: string,
  runId: string,
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  let detail = unwrap(await request(client, { path: basePath, requestId }));
  let delayMs = 1_000;
  while (Date.now() < deadline) {
    const run = readParentRun(detail, runId);
    if (run.completedAt !== undefined || run.status === 'failed') break;
    const action = readProvisioningAction(detail);
    if (action === 'instance.keycloak.execute' || action === 'instance.secret.rotate') break;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now())))
    );
    detail = unwrap(await request(client, { path: basePath, requestId }));
    delayMs = Math.min(delayMs * 2, 5_000);
  }
  return detail;
};

export const assignMissingModules = async (input: {
  client: StudioApiClient;
  basePath: string;
  moduleIds: readonly string[];
  requestId: string;
  idempotencyKey: string;
}): Promise<boolean> => {
  const detail = unwrap(
    await request(input.client, { path: input.basePath, requestId: input.requestId })
  );
  const requestedModuleIds = [...new Set(input.moduleIds)];
  const assignedModuleIds = new Set(readAssignedModuleIds(detail));
  for (const moduleId of requestedModuleIds) {
    if (assignedModuleIds.has(moduleId)) continue;
    const assignment = unwrap(
      await request(
        input.client,
        mutation(
          `${input.basePath}/modules/assign`,
          { moduleId },
          input.requestId,
          deriveIdempotencyKey(input.idempotencyKey, `module:${moduleId}`)
        )
      )
    );
    for (const assignedModuleId of readAssignedModuleIds(assignment)) {
      assignedModuleIds.add(assignedModuleId);
    }
  }
  await request(
    input.client,
    mutation(
      `${input.basePath}/modules/seed-iam-baseline`,
      {},
      input.requestId,
      deriveIdempotencyKey(input.idempotencyKey, 'iam-baseline')
    )
  );
  if (requestedModuleIds.length === 0) return false;
  await request(
    input.client,
    mutation(
      `${input.basePath}/modules/bootstrap-admin-structure`,
      { moduleIds: requestedModuleIds },
      input.requestId,
      deriveIdempotencyKey(input.idempotencyKey, 'admin-bootstrap')
    )
  );
  return true;
};
