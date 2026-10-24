import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  completeIdempotency,
  reserveIdempotency,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  runMainserverMutationWithFailureFinalization,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { writeSvaMainserverVoucher } from './service.js';
import { syncVoucherMedia, reconcileVoucherReferences } from './poi-route-vouchers.js';
import { raw, voucherSnapshotHash } from './vouchers-snapshot.js';
import {
  TYPE,
  BASE,
  preparationSchema,
  local,
  authorizedAggregate,
  type VoucherPreparationBody,
  type VoucherAggregate,
} from './vouchers-route-access.js';
async function preparedVoucherResult(
  actor: MainserverMutationActor,
  aggregate: VoucherAggregate,
  body: VoucherPreparationBody,
  scope: Pick<MainserverMutationActor, 'instanceId' | 'actorAccountId'>,
  preparationId: string,
  payloadHash: string
) {
  const target = aggregate.siblings.find((item) => item.id === body.voucherId);
  const voucherIdentity =
    target?.payload == null ? preparationId : raw(target.payload).id || preparationId;
  const recoveryContext = voucherSnapshotHash({
    organization: actor.activeOrganizationId ?? null,
    principal: actor.actingPrincipalType,
    credential: actor.credentialFingerprint,
  });
  const siblingIdentities = Object.fromEntries(
    aggregate.siblings.map((item) => [
      String(item.id),
      item.payload != null && typeof raw(item.payload).id === 'string' && raw(item.payload).id
        ? raw(item.payload).id
        : item.id === body.voucherId
          ? preparationId
          : randomUUID(),
    ])
  );
  const data = {
    preparationId,
    operation: body.voucherId ? 'update' : 'create',
    baseFingerprint: body.baseFingerprint,
    payloadHash,
    voucherIdentity,
    recoveryContext,
    siblingIdentities,
    previousMediaIds: aggregate.previousMediaIds,
    preparationFingerprint: aggregate.fingerprint,
    poiId: aggregate.poiId,
    poiName: aggregate.poi.name,
    affected: aggregate.siblings.map((item) => ({ id: item.id, title: item.title })),
    requiresReset: aggregate.siblings.length > 0,
  };
  await completeIdempotency({
    ...scope,
    endpoint: `${BASE}:prepare`,
    idempotencyKey: preparationId,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody: data,
  });
  return json({ data });
}
async function persistVoucher(
  actor: MainserverMutationActor,
  aggregate: VoucherAggregate,
  body: VoucherPreparationBody,
  scope: Pick<MainserverMutationActor, 'instanceId' | 'actorAccountId'>,
  preparationId: string,
  siblingIdentities: Readonly<Record<string, string>>,
  action: string
) {
  return runMainserverMutationWithFailureFinalization({
    actor,
    contentId: body.voucherId,
    operation: async () => {
      const provider = body.voucherId
        ? await authorizeMainserverExistingContent({
            actor,
            action,
            contentType: TYPE,
            contentId: body.voucherId,
            item: {
              id: body.voucherId,
              dataProvider: { id: String(raw(aggregate.poi.dataProvider).id) },
            },
          })
        : await authorizeMainserverCreateForPrincipal({ actor, action, contentType: TYPE });
      if (isResponse(provider)) return provider;
      let savedData: Awaited<ReturnType<typeof writeSvaMainserverVoucher>> | undefined;
      try {
        const data = await writeSvaMainserverVoucher({
          ...actor,
          poiId: aggregate.poiId,
          voucherId: body.voucherId,
          voucher: body.voucher,
          creationId: preparationId,
          siblingIdentities: siblingIdentities,
          expectedFingerprint: aggregate.fingerprint,
        });
        savedData = data;
        await reconcileVoucherReferences(actor.instanceId, data.voucherIdChanges ?? []);
        await syncVoucherMedia(
          actor.instanceId,
          data.id,
          body.voucher.mediaContents,
          aggregate.previousMediaIds
        );
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write', 'readback'],
          contentId: data.id,
          observedDataProviderId: data.dataProvider?.id,
        });
        const response = {
          data,
          meta: {
            reset: aggregate.siblings.length > 0,
            affectedPoiId: aggregate.poiId,
            operation: body.voucherId ? 'update' : 'create',
          },
        };
        await completeIdempotency({
          ...scope,
          endpoint: `${BASE}:commit`,
          idempotencyKey: preparationId,
          status: 'COMPLETED',
          responseStatus: 200,
          responseBody: response,
        });
        return json(response);
      } catch (error) {
        const conflict =
          !savedData && error instanceof Error && error.message === 'voucher_content_conflict';
        await finalizeMainserverMutation({
          actor,
          providerOutcome: savedData ? 'succeeded' : conflict ? 'failed' : 'unknown',
          reconciliationStatus: 'reconciliation_required',
          completedSteps: savedData ? ['provider_write', 'readback'] : [],
          contentId: savedData?.id ?? body.voucherId,
          lastErrorCode: conflict ? 'voucher_content_conflict' : 'voucher_outcome_unknown',
        });
        return errorJson(
          409,
          conflict ? 'voucher_content_conflict' : 'voucher_outcome_unknown',
          conflict ? 'voucher_content_conflict' : 'voucher_outcome_unknown'
        );
      }
    },
  });
}
export const mutate = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  operation: string
) => {
  const csrf = validateCsrf(request);
  if (csrf) return errorJson(403, 'csrf_validation_failed', 'csrf_validation_failed');
  const parsed = preparationSchema.safeParse(await request.json());
  if (!parsed.success) return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const body = parsed.data;
  const action = body.voucherId ? 'vouchers.update' : 'vouchers.create';
  const authorized = await local(ctx, action, body.voucherId);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor: authorized });
  if (isResponse(actor)) return actor;
  if (operation === 'commit' && actor.operationExternalId !== body.preparationId)
    return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const aggregate = await authorizedAggregate(ctx, actor, body);
  if (isResponse(aggregate)) return aggregate;
  const payloadHash = preparedVoucherHash(actor, aggregate, body, operation);
  const scope = { instanceId: actor.instanceId, actorAccountId: actor.actorAccountId };
  const preparationId = operation === 'prepare' ? randomUUID() : body.preparationId;
  if (!preparationId)
    return errorJson(400, 'voucher_confirmation_required', 'voucher_confirmation_required');
  const prepared = await reserveIdempotency({
    ...scope,
    endpoint: `${BASE}:prepare`,
    idempotencyKey: preparationId,
    payloadHash,
  });
  if (operation === 'prepare') {
    if (prepared.status !== 'reserved')
      return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
    return preparedVoucherResult(actor, aggregate, body, scope, preparationId, payloadHash);
  }
  if (prepared.status !== 'replay')
    return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
  if (aggregate.siblings.length && body.confirmed !== true)
    return errorJson(409, 'voucher_confirmation_required', 'voucher_confirmation_required');
  const preparedIdentities = z
    .object({
      siblingIdentities: z.record(z.string(), z.string()),
      previousMediaIds: z.array(z.string()).default([]),
    })
    .parse(prepared.responseBody);
  const attempt = await reserveIdempotency({
    ...scope,
    endpoint: `${BASE}:commit`,
    idempotencyKey: preparationId,
    payloadHash,
  });
  if (attempt.status === 'replay') return json(attempt.responseBody, attempt.responseStatus);
  if (attempt.status !== 'reserved')
    return errorJson(409, 'voucher_outcome_unknown', 'voucher_outcome_unknown');
  if (body.preparationFingerprint !== aggregate.fingerprint)
    return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
  return persistVoucher(
    actor,
    aggregate,
    body,
    scope,
    preparationId,
    preparedIdentities.siblingIdentities,
    action
  );
};

function preparedVoucherHash(
  actor: MainserverMutationActor,
  aggregate: VoucherAggregate,
  body: VoucherPreparationBody,
  operation: string
) {
  return voucherSnapshotHash({
    fingerprint: operation === 'prepare' ? aggregate.fingerprint : body.preparationFingerprint,
    voucher: body.voucher,
    voucherId: body.voucherId ?? null,
    organization: actor.activeOrganizationId ?? null,
    principal: actor.actingPrincipalType,
    credential: actor.credentialFingerprint,
  });
}
