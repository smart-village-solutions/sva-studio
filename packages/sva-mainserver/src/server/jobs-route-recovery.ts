import { z } from 'zod';
import { reserveIdempotency, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { JOBS_TYPE, type JobRecord } from './jobs-contract.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import { authorizeJobMedia, syncJobMedia } from './jobs-route-access.js';
import { getSvaMainserverJob, recoverSvaMainserverJob } from './service.js';
import type { JobPreparedWrite } from './service-internals/service-jobs.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
  type MainserverMutationActor,
} from './mutation-principal.js';
const hex = z.string().regex(/^[a-f0-9]{64}$/);
export const endpoint = 'mainserver:jobs';
const preparedSchema = z
  .object({
    id: z.string().optional(),
    fingerprint: hex.optional(),
    providerId: z.string().optional(),
    previousEmploymentType: z.string().optional(),
    previousMediaIds: z.array(z.string()),
    expected: z.record(z.string(), z.unknown()),
  })
  .strict();
export type Scope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
}>;

function mutationReply(data: JobRecord, operation: 'create' | 'update', partial = false) {
  const response = json(
    {
      data: { ...data, ...(partial ? { reconciliationRequired: true } : {}) },
      meta: {
        operation,
        reconciliationStatus: partial ? 'reconciliation_required' : 'complete',
      },
    },
    partial ? 202 : operation === 'create' ? 201 : 200
  );
  response.headers.set('x-sva-mainserver-entity-id', data.id);
  return response;
}

export async function authorizeWrite(actor: MainserverMutationActor, prepared: JobPreparedWrite) {
  const action = prepared.id ? 'jobs.update' : 'jobs.create';
  if (!prepared.id)
    return authorizeMainserverCreateForPrincipal({
      actor,
      action,
      contentType: JOBS_TYPE,
    });
  const current = await getSvaMainserverJob({ ...actor, jobId: prepared.id });
  return authorizeMainserverExistingContent({
    actor,
    action,
    contentType: JOBS_TYPE,
    contentId: prepared.id,
    item: current.data,
    additionalActions: toMainserverAdditionalActions(
      resolveMainserverVisibilityAction(current.data.visible, prepared.expected.visible as boolean)
    ),
  });
}

export async function finish(
  actor: MainserverMutationActor,
  data: JobRecord,
  prepared: JobPreparedWrite
) {
  let partial = false;
  try {
    if (!prepared.id) {
      const binding = await recordCreatedMainserverDataProvider({
        actor,
        created: data,
        reread: async () => (await getSvaMainserverJob({ ...actor, jobId: data.id })).data,
        contentType: JOBS_TYPE,
      });
      partial = binding.outcome === 'conflict' || binding.outcome === 'reconciliation_required';
    }
    await syncJobMedia(actor, data, prepared.previousMediaIds);
    await finalizeMainserverMutation({
      actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: partial ? 'reconciliation_required' : 'complete',
      completedSteps: ['provider_write', 'readback', 'media_references'],
      contentId: data.id,
      observedDataProviderId: data.dataProvider?.id,
    });
  } catch {
    partial = true;
    await finalizeMainserverMutation({
      actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: ['provider_write', 'readback'],
      contentId: data.id,
      observedDataProviderId: data.dataProvider?.id,
      lastErrorCode: 'job_follow_up_failed',
    }).catch(() => undefined);
  }
  return mutationReply(data, prepared.id ? 'update' : 'create', partial);
}

export async function recover(
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  scope: Scope,
  hash: string,
  id?: string
) {
  const saved = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    payloadHash: hash,
  });
  if (saved.status !== 'replay')
    return errorJson(409, 'job_outcome_unknown', 'job_outcome_unknown');
  const prepared = preparedSchema.parse(saved.responseBody);
  if (prepared.id !== id) return errorJson(409, 'job_content_conflict', 'job_content_conflict');
  const authorization = await authorizeWrite(actor, prepared);
  if (isResponse(authorization)) return authorization;
  const data = await recoverSvaMainserverJob({ ...actor, prepared });
  // Recheck the original operation at the resolved object and its provider.
  const readAccess = await authorizeMainserverExistingContent({
    actor,
    action: prepared.id ? 'jobs.update' : 'jobs.create',
    contentType: JOBS_TYPE,
    contentId: data.id,
    item: data,
  });
  if (isResponse(readAccess)) return readAccess;
  const media = await authorizeJobMedia(ctx, data.input, prepared.previousMediaIds, data.id);
  if (isResponse(media)) return media;
  return finish(actor, data, prepared);
}
