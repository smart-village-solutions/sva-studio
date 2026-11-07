import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  completeIdempotency,
  reserveIdempotency,
  validateCsrf,
  withExternalContentMutationLock,
  withMediaService,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { JOBS_TYPE } from './jobs-contract.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import { jobLocalAccess } from './jobs-route-access.js';
import { operationHash } from './jobs-route-write.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  getSvaMainserverJob,
  deleteSvaMainserverJob,
  verifySvaMainserverJobDeleted,
} from './service.js';
import { JobPrewriteError } from './service-internals/service-jobs.js';
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z.union([
  z.object({ baseFingerprint: hex }).strict(),
  z.object({ recover: z.literal(true), inputHash: hex }).strict(),
]);
const savedSchema = z
  .object({ id: z.string(), fingerprint: hex, dataProvider: z.object({ id: z.string() }) })
  .strict();
const endpoint = 'mainserver:jobs:delete';
async function finish(actor: MainserverMutationActor, id: string, providerId: string) {
  let partial = false;
  try {
    await withMediaService(actor.instanceId, (service) =>
      service.replaceReferences({
        instanceId: actor.instanceId,
        targetType: JOBS_TYPE,
        targetId: id,
        references: [],
      })
    );
    await finalizeMainserverMutation({
      actor,
      contentId: id,
      observedDataProviderId: providerId,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps: ['provider_delete', 'readback', 'media_references'],
    });
  } catch {
    partial = true;
    await finalizeMainserverMutation({
      actor,
      contentId: id,
      observedDataProviderId: providerId,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: ['provider_delete', 'readback'],
      lastErrorCode: 'job_follow_up_failed',
    }).catch(() => undefined);
  }
  const response = json(
    {
      data: { id, deleted: true, reconciliationRequired: partial },
      meta: { reconciliationStatus: partial ? 'reconciliation_required' : 'complete' },
    },
    partial ? 202 : 200
  );
  response.headers.set('x-sva-mainserver-entity-id', id);
  return response;
}
export async function removeJob(request: Request, ctx: AuthenticatedRequestContext, id: string) {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const authorized = await jobLocalAccess(ctx, 'jobs.delete', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  const text = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson(400, 'job_invalid_input', 'job_invalid_input');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, 'job_invalid_input', 'job_invalid_input');
  const hash = operationHash(
    actor,
    'recover' in parsed.data
      ? parsed.data.inputHash
      : createHash('sha256').update(text).digest('hex'),
    id
  );
  const scope = {
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    idempotencyKey: actor.operationExternalId,
  };
  const recovery = 'recover' in parsed.data;
  // Read-only reconciliation must use the original provider binding, even after the record disappeared.
  if (recovery) {
    const saved = await reserveIdempotency({
      ...scope,
      endpoint: `${endpoint}:expected`,
      payloadHash: hash,
    });
    if (saved.status !== 'replay')
      return errorJson(409, 'job_outcome_unknown', 'job_outcome_unknown');
    const expected = savedSchema.parse(saved.responseBody);
    if (expected.id !== id) return errorJson(409, 'job_content_conflict', 'job_content_conflict');
    const permission = await authorizeMainserverExistingContent({
      actor,
      action: 'jobs.delete',
      contentType: JOBS_TYPE,
      contentId: id,
      item: expected,
    });
    if (isResponse(permission)) return permission;
    await verifySvaMainserverJobDeleted({ ...actor, jobId: id });
    return finish(actor, id, expected.dataProvider.id);
  }
  const current = await getSvaMainserverJob({ ...actor, jobId: id });
  if (
    !('baseFingerprint' in parsed.data) ||
    current.data.contentFingerprint !== parsed.data.baseFingerprint
  )
    return errorJson(409, 'job_content_conflict', 'job_content_conflict');
  const permission = await authorizeMainserverExistingContent({
    actor,
    action: 'jobs.delete',
    contentType: JOBS_TYPE,
    contentId: id,
    item: current.data,
  });
  if (isResponse(permission)) return permission;
  const expected = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    payloadHash: hash,
  });
  if (expected.status !== 'reserved')
    return errorJson(409, 'job_outcome_unknown', 'job_outcome_unknown');
  await completeIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody: {
      id,
      fingerprint: current.data.contentFingerprint,
      dataProvider: { id: current.data.dataProvider.id },
    },
  });
  const attempt = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:write`,
    payloadHash: hash,
  });
  if (attempt.status !== 'reserved')
    return errorJson(409, 'job_outcome_unknown', 'job_outcome_unknown');
  try {
    await withExternalContentMutationLock({
      instanceId: actor.instanceId,
      referenceId: `GenericItem:${id}`,
      execute: () =>
        deleteSvaMainserverJob({
          ...actor,
          jobId: id,
          fingerprint: current.data.contentFingerprint,
        }),
    });
    return await finish(actor, id, current.data.dataProvider.id);
  } catch (error) {
    const definitive = error instanceof JobPrewriteError;
    const code = definitive ? error.message : 'job_outcome_unknown';
    await finalizeMainserverMutation({
      actor,
      contentId: id,
      providerOutcome: definitive ? 'failed' : 'unknown',
      reconciliationStatus: definitive ? 'failed' : 'reconciliation_required',
      completedSteps: [],
      lastErrorCode: code,
    }).catch(() => undefined);
    return errorJson(409, code, code);
  }
}
