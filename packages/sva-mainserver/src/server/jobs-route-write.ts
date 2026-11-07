import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  completeIdempotency,
  reserveIdempotency,
  validateCsrf,
  withExternalContentMutationLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { jobInputSchema } from './jobs-contract.js';
import { errorJson, isResponse } from './content-route-core.js';
import { jobLocalAccess, authorizeJobMedia } from './jobs-route-access.js';
import { jobFingerprint } from './jobs-snapshot.js';
import { voucherSnapshotHash } from './vouchers-snapshot.js';
import { getSvaMainserverJob, prepareSvaMainserverJob, writeSvaMainserverJob } from './service.js';
import {
  JobPrewriteError,
  JobWriteError,
  type JobPreparedWrite,
} from './service-internals/service-jobs.js';
import {
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { endpoint, authorizeWrite, finish, recover, type Scope } from './jobs-route-recovery.js';
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const writeSchema = z.object({ job: jobInputSchema, baseFingerprint: hex.optional() }).strict();
const recoverSchema = z.object({ recover: z.literal(true), inputHash: hex }).strict();
export const operationHash = (actor: MainserverMutationActor, inputHash: string, id?: string) =>
  voucherSnapshotHash({
    inputHash,
    id,
    organization: actor.activeOrganizationId ?? null,
    principal: actor.actingPrincipalType,
    credential: actor.credentialFingerprint,
  });
export async function mutateJob(request: Request, ctx: AuthenticatedRequestContext, id?: string) {
  try {
    if (validateCsrf(request))
      return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
    const authorized = await jobLocalAccess(ctx, id ? 'jobs.update' : 'jobs.create', id);
    if (isResponse(authorized)) return authorized;
    const actor = await resolveMainserverMutationActor({
      request,
      ctx,
      authorizedActor: authorized,
    });
    if (isResponse(actor)) return actor;
    const text = await request.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return errorJson(400, 'job_invalid_input', 'job_invalid_input');
    }
    const scope = {
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      idempotencyKey: actor.operationExternalId,
    };
    const reconciliation = recoverSchema.safeParse(body);
    if (reconciliation.success)
      return recover(
        ctx,
        actor,
        scope,
        operationHash(actor, reconciliation.data.inputHash, id),
        id
      );
    const parsed = writeSchema.safeParse(body);
    if (!parsed.success) return errorJson(400, 'job_invalid_input', 'job_invalid_input');
    const prepared = await prepareWrite(actor, parsed.data, id);
    if (isResponse(prepared)) return prepared;
    const media = await authorizeJobMedia(
      ctx,
      actor,
      parsed.data.job,
      prepared.previousMediaIds,
      id
    );
    if (isResponse(media)) return media;
    const providerAuthorization = await authorizeWrite(actor, prepared);
    if (isResponse(providerAuthorization)) return providerAuthorization;
    // Return without awaiting: failures after this boundary must remain uncertain.
    return executeWrite(
      ctx,
      actor,
      scope,
      operationHash(actor, createHash('sha256').update(text).digest('hex'), id),
      prepared,
      id
    );
  } catch (error) {
    if (error instanceof Error && /^job_[a-z_]+$/.test(error.message)) throw error;
    return errorJson(502, 'job_prewrite_failed', 'job_prewrite_failed');
  }
}

async function executeWrite(
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  scope: Scope,
  hash: string,
  prepared: JobPreparedWrite,
  id?: string
) {
  const reservation = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    payloadHash: hash,
  });
  if (reservation.status === 'replay') return recover(ctx, actor, scope, hash, id);
  if (reservation.status !== 'reserved')
    return errorJson(409, 'job_outcome_unknown', 'job_outcome_unknown');
  await completeIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody: prepared,
  });
  const attempt = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:write`,
    payloadHash: hash,
  });
  if (attempt.status !== 'reserved') return recover(ctx, actor, scope, hash, id);
  try {
    const execute = () => writeSvaMainserverJob({ ...actor, prepared });
    const data = id
      ? await withExternalContentMutationLock({
          instanceId: actor.instanceId,
          referenceId: `GenericItem:${id}`,
          execute,
        })
      : await execute();
    return await finish(actor, data, prepared);
  } catch (error) {
    const conflict = error instanceof JobPrewriteError;
    const providerId = error instanceof JobWriteError ? error.providerId : undefined;
    const code = conflict ? (error as JobPrewriteError).message : 'job_outcome_unknown';
    await finalizeMainserverMutation({
      actor,
      providerOutcome: conflict ? 'failed' : providerId ? 'succeeded' : 'unknown',
      reconciliationStatus: conflict ? 'complete' : 'reconciliation_required',
      completedSteps: providerId ? ['provider_write'] : [],
      contentId: providerId ?? id,
      lastErrorCode: code,
    }).catch(() => undefined);
    const response = errorJson(409, code, code);
    if (providerId) response.headers.set('x-sva-mainserver-entity-id', providerId);
    return response;
  }
}

async function prepareWrite(
  actor: MainserverMutationActor,
  input: z.infer<typeof writeSchema>,
  id?: string
) {
  const current = id ? await getSvaMainserverJob({ ...actor, jobId: id }) : undefined;
  if (current && input.baseFingerprint !== jobFingerprint(current.item))
    return errorJson(409, 'job_content_conflict', 'job_content_conflict');
  const prepared = prepareSvaMainserverJob(input.job, actor.operationExternalId, current?.item);
  return prepared;
}
