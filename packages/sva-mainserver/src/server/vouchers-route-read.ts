import { z } from 'zod';
import {
  reserveIdempotency,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  resolveMainserverResourceActor,
  resolveMainserverResourceAccess,
} from './mutation-principal.js';
import {
  getSvaMainserverVoucher,
  getSvaMainserverVoucherPoi,
  listSvaMainserverPoi,
  listSvaMainserverVouchers,
  loadSvaMainserverDataProviderIdentity,
} from './service.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  authorizeVoucherMedia,
  syncVoucherMedia,
  reconcileVoucherReferences,
} from './poi-route-vouchers.js';
import {
  raw,
  records,
  voucherSnapshotHash,
  voucherWriteMatches,
  rawRecordSchema,
} from './vouchers-snapshot.js';
import { TYPE, BASE, local } from './vouchers-route-access.js';
export const reconcile = async (request: Request, ctx: AuthenticatedRequestContext) => {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const parsed = z
    .object({ preparationId: z.string().uuid(), payloadHash: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .safeParse(await request.json());
  if (!parsed.success) return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const authorized = await local(ctx, 'vouchers.read');
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  if (actor.operationExternalId !== parsed.data.preparationId)
    return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const prepared = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: `${BASE}:prepare`,
    idempotencyKey: parsed.data.preparationId,
    payloadHash: parsed.data.payloadHash,
  });
  if (prepared.status !== 'replay')
    return errorJson(409, 'voucher_outcome_unknown', 'voucher_outcome_unknown');
  const binding = z
    .object({
      poiId: z.string(),
      voucherIdentity: z.string(),
      recoveryContext: z.string(),
      operation: z.enum(['create', 'update']),
      siblingIdentities: z.record(z.string(), z.string()),
      previousMediaIds: z.array(z.string()).default([]),
      expectedSnapshot: rawRecordSchema.nullable().default(null),
    })
    .parse(prepared.responseBody);
  if (
    binding.recoveryContext !==
    voucherSnapshotHash({
      organization: actor.activeOrganizationId ?? null,
      principal: actor.actingPrincipalType,
      credential: actor.credentialFingerprint,
    })
  )
    return errorJson(409, 'voucher_context_changed', 'voucher_context_changed');
  const poiAccess = await local(ctx, 'poi.read', binding.poiId, 'poi.point-of-interest');
  if (isResponse(poiAccess)) return poiAccess;
  const aggregate = await getSvaMainserverVoucherPoi({ ...actor, poiId: binding.poiId });
  // The complete expectation also contains the bound POI operation identity.
  // Old preparations without an expectation remain unresolved.
  if (!voucherWriteMatches(aggregate.poi, binding.expectedSnapshot))
    return errorJson(409, 'voucher_outcome_unknown', 'voucher_outcome_unknown');
  const matches = records(aggregate.poi.vouchers).filter(
    (item) => item.payload != null && raw(item.payload).id === binding.voucherIdentity
  );
  if (matches.length !== 1)
    return errorJson(409, 'voucher_outcome_unknown', 'voucher_outcome_unknown');
  const id = String(matches[0]!.id);
  const access = await local(ctx, 'vouchers.read', id);
  if (isResponse(access)) return access;
  const data = await getSvaMainserverVoucher({ ...actor, voucherId: id });
  const resourceAccess = await resolveMainserverResourceAccess({
    actor,
    actions: ['vouchers.read'],
    contentType: TYPE,
    item: { id, dataProvider: data.dataProvider ?? undefined },
    forceExactScopeActions: ['vouchers.read'],
  });
  if (!resourceAccess['vouchers.read']) return errorJson(403, 'forbidden', 'forbidden');
  const changes = Object.entries(binding.siblingIdentities).map(([previousId, identity]) => {
    const match = records(aggregate.poi.vouchers).filter(
      (item) => item.payload != null && raw(item.payload).id === identity
    );
    if (match.length !== 1) throw new Error('voucher_identity_conflict');
    return { previousId, id: String(match[0]!.id) };
  });
  const mediaAccess = await authorizeVoucherMedia(
    ctx,
    data.mediaContents,
    binding.previousMediaIds,
    data.id
  );
  if (mediaAccess) return mediaAccess;
  await reconcileVoucherReferences(actor.instanceId, changes);
  await syncVoucherMedia(actor.instanceId, data.id, data.mediaContents, binding.previousMediaIds);
  await finalizeMainserverMutation({
    actor,
    providerOutcome: 'succeeded',
    reconciliationStatus: 'complete',
    completedSteps: ['provider_write', 'readback', 'reconciled'],
    contentId: data.id,
    observedDataProviderId: data.dataProvider?.id,
  });
  return json({ data, meta: { affectedPoiId: binding.poiId, operation: binding.operation } });
};
export const locations = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const authorized = await local(ctx, 'poi.read', undefined, 'poi.point-of-interest');
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverResourceActor({ request, ctx, authorizedActor: authorized });
  if (!actor) return errorJson(403, 'forbidden', 'forbidden');
  const identity = await loadSvaMainserverDataProviderIdentity(actor);
  const page = await listSvaMainserverPoi({
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible: true,
  });
  const data = [];
  for (const item of page.data) {
    if (item.dataProvider?.id !== identity.dataProvider.id) continue;
    const decision = await local(ctx, 'poi.update', item.id, 'poi.point-of-interest');
    if (!isResponse(decision))
      data.push({ id: item.id, name: item.name, addresses: item.addresses });
  }
  return json({ data, pagination: page.pagination });
};
export const read = async (request: Request, ctx: AuthenticatedRequestContext, id?: string) => {
  const authorized = await local(ctx, 'vouchers.read', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverResourceActor({ request, ctx, authorizedActor: authorized });
  if (!actor) return errorJson(403, 'forbidden', 'forbidden');
  const connection = actor;
  if (!id) {
    const url = new URL(request.url);
    const result = await listSvaMainserverVouchers({
      ...connection,
      ...parseMainserverListQuery(request),
      poiId: url.searchParams.get('poiId') ?? undefined,
      visible: url.searchParams.has('visible')
        ? url.searchParams.get('visible') === 'true'
        : undefined,
      search: url.searchParams.get('search') ?? undefined,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
    });
    const data = [];
    for (const item of result.data) {
      const access = await resolveMainserverResourceAccess({
        actor,
        actions: ['vouchers.read'],
        contentType: TYPE,
        item: { id: item.id, dataProvider: item.dataProvider ?? undefined },
        forceExactScopeActions: ['vouchers.read'],
      });
      if (access['vouchers.read']) data.push(item);
    }
    return json({ ...result, data });
  }
  const data = await getSvaMainserverVoucher({ ...connection, voucherId: id });
  const access = actor
    ? await resolveMainserverResourceAccess({
        actor,
        actions: ['vouchers.read', 'vouchers.update', 'vouchers.publish'],
        contentType: TYPE,
        item: { id: data.id, dataProvider: data.dataProvider ?? undefined },
        forceExactScopeActions: ['vouchers.read'],
      })
    : {};
  if (actor && !access['vouchers.read']) return errorJson(403, 'forbidden', 'forbidden');
  return json({ data, meta: { access }, fetchedAt: new Date().toISOString() });
};
