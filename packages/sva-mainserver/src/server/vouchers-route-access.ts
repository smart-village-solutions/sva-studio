import { z } from 'zod';
import {
  authorizeContentPrimitiveForUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { errorJson, isResponse } from './content-route-core.js';
import { type MainserverMutationActor } from './mutation-principal.js';
import { getSvaMainserverVoucherPoi, loadSvaMainserverDataProviderIdentity } from './service.js';
import { authorizeVoucherMedia } from './poi-route-vouchers.js';
import { voucherHasContentChanges, voucherInputSchema } from './vouchers-model.js';
import { raw, records, voucherContentFingerprint } from './vouchers-snapshot.js';
export const TYPE = 'vouchers.voucher';
export const BASE = '/api/v1/mainserver/vouchers';
export const preparationSchema = z
  .object({
    voucher: voucherInputSchema,
    voucherId: z.string().regex(/^\d+$/).optional(),
    baseFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    preparationId: z.string().uuid().optional(),
    confirmed: z.boolean().optional(),
    preparationFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export const local = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentId?: string,
  contentType = TYPE
) => {
  const decision = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: { contentType, ...(contentId ? { contentId } : {}) },
    credentialVisibleCompatibility: false,
  });
  return decision.ok
    ? {
        instanceId: decision.actor.instanceId,
        keycloakSubject: decision.actor.keycloakSubject,
        activeOrganizationId: decision.actor.organizationId ?? ctx.activeOrganizationId,
      }
    : errorJson(decision.status, decision.error, decision.message, decision.permissionDenial);
};
export const authorizedAggregate = async (
  ctx: AuthenticatedRequestContext,
  actor: MainserverMutationActor,
  body: z.infer<typeof preparationSchema>
) => {
  const poiId = body.voucher.pointOfInterestIds[0];
  if (!poiId) return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const poiAccess = await local(ctx, 'poi.update', poiId, 'poi.point-of-interest');
  if (isResponse(poiAccess)) return poiAccess;
  const current = await getSvaMainserverVoucherPoi({ ...actor, poiId });
  if (!allowedVoucherCategories(body.voucher.categories, current.categories ?? []))
    return errorJson(400, 'voucher_invalid_input', 'voucher_invalid_input');
  const identity = await loadSvaMainserverDataProviderIdentity(actor);
  if (raw(current.poi.dataProvider).id !== identity.dataProvider.id)
    return errorJson(403, 'voucher_ownership_conflict', 'voucher_ownership_conflict');
  const siblings = records(current.poi.vouchers);
  if (body.voucherId && !siblings.some((item) => item.id === body.voucherId))
    return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
  for (const item of siblings) {
    const result = await local(ctx, 'vouchers.update', String(item.id));
    if (isResponse(result)) return result;
  }
  const target = siblings.find((item) => item.id === body.voucherId);
  if (
    target &&
    (body.baseFingerprint !== voucherContentFingerprint(target) ||
      target.visible !== body.voucher.visible)
  )
    return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
  if (target && !voucherHasContentChanges(target, body.voucher))
    return errorJson(409, 'voucher_no_changes', 'voucher_no_changes');
  if (target ? target.visible !== body.voucher.visible : body.voucher.visible) {
    const publish = await local(ctx, 'vouchers.publish', body.voucherId);
    if (isResponse(publish)) return publish;
  }
  const previousMediaIds = voucherMediaIds(target);
  const mediaAccess = await authorizeVoucherMedia(
    ctx,
    body.voucher.mediaContents,
    previousMediaIds,
    body.voucherId
  );
  if (mediaAccess) return mediaAccess;
  return { ...current, siblings, poiId, previousMediaIds };
};
export type VoucherPreparationBody = z.infer<typeof preparationSchema>;
export type VoucherAggregate = Exclude<Awaited<ReturnType<typeof authorizedAggregate>>, Response>;

function allowedVoucherCategories(
  requested: readonly { name: string }[],
  categories: readonly Record<string, unknown>[]
) {
  return requested.every((category) =>
    categories.some(
      (item) =>
        item.name === category.name &&
        item.active === true &&
        (!Array.isArray(item.dataTypes) ||
          !item.dataTypes.length ||
          item.dataTypes.includes('generic_item_voucher'))
    )
  );
}

function voucherMediaIds(target: Record<string, unknown> | undefined) {
  return target
    ? records(target.mediaContents ?? []).flatMap((item) => {
        const id = item.payload == null ? undefined : raw(item.payload).studioMediaAssetId;
        return typeof id === 'string' ? [id] : [];
      })
    : [];
}
