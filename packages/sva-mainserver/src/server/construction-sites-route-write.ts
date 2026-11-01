import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  completeIdempotency,
  reserveIdempotency,
  validateCsrf,
  withExternalContentMutationLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { constructionSiteInputSchema } from './construction-sites-contract.js';
import { errorJson, isResponse } from './content-route-core.js';
import {
  constructionSiteLocalAccess,
  authorizeConstructionSiteMedia,
} from './construction-sites-route-access.js';
import { constructionSiteFingerprint } from './construction-sites-snapshot.js';
import { voucherSnapshotHash } from './vouchers-snapshot.js';
import {
  listSvaMainserverCategories,
  getSvaMainserverConstructionSite,
  prepareSvaMainserverConstructionSite,
  writeSvaMainserverConstructionSite,
} from './service.js';
import {
  ConstructionSiteWriteError,
  type ConstructionSitePreparedWrite,
} from './service-internals/service-construction-sites.js';
import {
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  endpoint,
  authorizeWrite,
  finish,
  recover,
  type Scope,
} from './construction-sites-route-recovery.js';
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const writeSchema = z
  .object({ site: constructionSiteInputSchema, baseFingerprint: hex.optional() })
  .strict();
const recoverSchema = z.object({ recover: z.literal(true), inputHash: hex }).strict();
const operationHash = (actor: MainserverMutationActor, inputHash: string, id?: string) =>
  voucherSnapshotHash({
    inputHash,
    id,
    organization: actor.activeOrganizationId ?? null,
    principal: actor.actingPrincipalType,
    credential: actor.credentialFingerprint,
  });
export async function mutateConstructionSite(
  request: Request,
  ctx: AuthenticatedRequestContext,
  id?: string
) {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const authorized = await constructionSiteLocalAccess(
    ctx,
    id ? 'construction-sites.update' : 'construction-sites.create',
    id
  );
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  const text = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson(400, 'construction_site_invalid_input', 'construction_site_invalid_input');
  }
  const scope = {
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    idempotencyKey: actor.operationExternalId,
  };
  const reconciliation = recoverSchema.safeParse(body);
  if (reconciliation.success)
    return recover(ctx, actor, scope, operationHash(actor, reconciliation.data.inputHash, id), id);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success)
    return errorJson(400, 'construction_site_invalid_input', 'construction_site_invalid_input');
  const prepared = await prepareWrite(ctx, actor, parsed.data, id);
  if (isResponse(prepared)) return prepared;
  const media = await authorizeConstructionSiteMedia(
    ctx,
    parsed.data.site,
    prepared.previousMediaIds,
    id
  );
  if (isResponse(media)) return media;
  const providerAuthorization = await authorizeWrite(actor, prepared);
  if (isResponse(providerAuthorization)) return providerAuthorization;
  return executeWrite(
    ctx,
    actor,
    scope,
    operationHash(actor, createHash('sha256').update(text).digest('hex'), id),
    prepared,
    id
  );
}

async function executeWrite(
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  scope: Scope,
  hash: string,
  prepared: ConstructionSitePreparedWrite,
  id?: string
) {
  const reservation = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:expected`,
    payloadHash: hash,
  });
  if (reservation.status === 'replay') return recover(ctx, actor, scope, hash, id);
  if (reservation.status !== 'reserved')
    return errorJson(409, 'construction_site_outcome_unknown', 'construction_site_outcome_unknown');
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
    const execute = () => writeSvaMainserverConstructionSite({ ...actor, prepared });
    const data = id
      ? await withExternalContentMutationLock({
          instanceId: actor.instanceId,
          referenceId: `GenericItem:${id}`,
          execute,
        })
      : await execute();
    return await finish(actor, data, prepared);
  } catch (error) {
    const conflict =
      error instanceof Error && error.message === 'construction_site_content_conflict';
    const providerId = error instanceof ConstructionSiteWriteError ? error.providerId : undefined;
    const code = conflict
      ? 'construction_site_content_conflict'
      : 'construction_site_outcome_unknown';
    await finalizeMainserverMutation({
      actor,
      providerOutcome: conflict ? 'failed' : providerId ? 'succeeded' : 'unknown',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: providerId ? ['provider_write'] : [],
      contentId: providerId ?? id,
      lastErrorCode: code,
    }).catch(() => undefined);
    const response = errorJson(409, code, code);
    if (providerId) response.headers.set('x-sva-mainserver-entity-id', providerId);
    return response;
  }
}

async function validateCategories(
  actor: MainserverMutationActor,
  site: z.infer<typeof constructionSiteInputSchema>,
  existing: readonly { name: string }[]
) {
  const addedCategories = site.categories.filter(
    (category) => !existing.some((existing) => existing.name === category.name)
  );
  if (addedCategories.length) {
    const allowed = (await listSvaMainserverCategories(actor)).filter(
      (category) =>
        !category.dataTypes.length || category.dataTypes.includes('generic_item_construction_site')
    );
    if (
      addedCategories.some(
        (category) => !allowed.some((candidate) => candidate.name === category.name)
      )
    )
      return errorJson(400, 'construction_site_invalid_input', 'construction_site_invalid_input');
  }
  return null;
}

async function prepareWrite(
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  input: z.infer<typeof writeSchema>,
  id?: string
) {
  const current = id ? await getSvaMainserverConstructionSite({ ...actor, siteId: id }) : undefined;
  if (current && input.baseFingerprint !== constructionSiteFingerprint(current.item))
    return errorJson(
      409,
      'construction_site_content_conflict',
      'construction_site_content_conflict'
    );
  if (input.site.visible && !current?.data.visible) {
    const publish = await constructionSiteLocalAccess(ctx, 'content.publish', id);
    if (isResponse(publish)) return publish;
  }
  const categoryError = await validateCategories(
    actor,
    input.site,
    current?.data.input.categories ?? []
  );
  if (categoryError) return categoryError;
  const prepared = prepareSvaMainserverConstructionSite(
    input.site,
    actor.operationExternalId,
    current?.item
  );
  return prepared;
}
