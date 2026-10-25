import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  authorizeMediaPrimitiveForUser,
  bindExternalContentReference,
  loadExternalContentReferenceBySourceEntity,
  withExternalContentMutationLock,
  withMediaService,
  authorizeContentPrimitiveForUser,
  reserveIdempotency,
  completeIdempotency,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import type { SvaMainserverPoiInput } from '../types.js';
import { errorJson, json } from './content-route-core.js';
import {
  getSvaMainserverPoiVoucherState,
  loadSvaMainserverDataProviderIdentity,
} from './service.js';
import type { MainserverMutationActor } from './mutation-principal.js';
import { raw, records, voucherSnapshotHash } from './vouchers-snapshot.js';
const endpoint = 'mainserver:poi-voucher-reset';
export async function preparePoiVoucherUpdate(
  input: Readonly<{
    request: Request;
    ctx: AuthenticatedRequestContext;
    actor: MainserverMutationActor;
    poiId: string;
    poi: SvaMainserverPoiInput;
  }>
) {
  const { request, ctx, actor, poiId, poi } = input;
  const preparing = request.headers.get('x-sva-voucher-reset-mode') === 'prepare';
  // The low-level writer protects legacy clients without this preflight.
  if (!preparing && !request.headers.has('x-sva-voucher-reset-id')) return {};
  const state = await getSvaMainserverPoiVoucherState({ ...actor, poiId });
  const siblings = records(state.poi.vouchers);
  if (!siblings.length) return preparing ? json({ voucherReset: { required: false } }) : {};
  const identity = await loadSvaMainserverDataProviderIdentity(actor);
  if (raw(state.poi.dataProvider).id !== identity.dataProvider.id)
    return errorJson(403, 'voucher_ownership_conflict', 'voucher_ownership_conflict');
  for (const item of siblings) {
    const access = await authorizeContentPrimitiveForUser({
      ctx,
      action: 'vouchers.update',
      resource: { contentType: 'vouchers.voucher', contentId: String(item.id) },
      credentialVisibleCompatibility: false,
    });
    if (!access.ok)
      return errorJson(access.status, access.error, access.message, access.permissionDenial);
  }
  const fingerprint = preparing
    ? state.fingerprint
    : request.headers.get('x-sva-voucher-reset-fingerprint');
  const id = preparing ? randomUUID() : request.headers.get('x-sva-voucher-reset-id');
  if (!id || !/^[a-f0-9-]{36}$/i.test(id) || !fingerprint)
    return errorJson(400, 'voucher_confirmation_required', 'voucher_confirmation_required');
  const payloadHash = voucherSnapshotHash({
    poiId,
    poi,
    fingerprint,
    principal: actor.actingPrincipalType,
    credential: actor.credentialFingerprint,
    organization: actor.activeOrganizationId ?? null,
  });
  const scope = {
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    idempotencyKey: id,
  };
  const prepared = await reserveIdempotency({ ...scope, endpoint, payloadHash });
  if (preparing) {
    if (prepared.status !== 'reserved')
      return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
    const identities = existingVoucherIdentities(siblings);
    const voucherReset = {
      identities,
      required: true,
      id,
      fingerprint,
      affected: siblings.map((item) => ({ id: item.id, title: item.title })),
    };
    await completeIdempotency({
      ...scope,
      endpoint,
      status: 'COMPLETED',
      responseStatus: 200,
      responseBody: voucherReset,
    });
    return json({ voucherReset });
  }
  if (prepared.status !== 'replay' || fingerprint !== state.fingerprint)
    return errorJson(409, 'voucher_content_conflict', 'voucher_content_conflict');
  const attempt = await reserveIdempotency({
    ...scope,
    endpoint: `${endpoint}:commit`,
    payloadHash,
  });
  if (attempt.status !== 'reserved')
    return errorJson(409, 'voucher_outcome_unknown', 'voucher_outcome_unknown');
  const binding = z
    .object({ identities: z.record(z.string(), z.string()) })
    .parse(prepared.responseBody);
  return {
    voucherResetFingerprint: state.fingerprint,
    voucherResetIdentities: binding.identities,
    voucherResetOperationId: id,
  };
}
export async function reconcileVoucherReferences(
  instanceId: string,
  changes: readonly Readonly<{
    previousId: string;
    id: string;
  }>[]
) {
  for (const change of changes) {
    if (change.previousId === change.id) continue;
    const previous = await loadExternalContentReferenceBySourceEntity({
      instanceId,
      sourceSystem: 'mainserver',
      sourceEntityType: 'vouchers.voucher',
      sourceEntityId: change.previousId,
      exactSourceEntityType: true,
    });
    if (previous)
      await withExternalContentMutationLock({
        instanceId,
        referenceId: previous.id,
        execute: async () => {
          const next = await loadExternalContentReferenceBySourceEntity({
            instanceId,
            sourceSystem: 'mainserver',
            sourceEntityType: 'vouchers.voucher',
            sourceEntityId: change.id,
            exactSourceEntityType: true,
          });
          if (next && next.contentId !== previous.contentId)
            throw new Error('voucher_identity_conflict');
          await bindExternalContentReference({
            instanceId,
            referenceId: previous.id,
            sourceEntityId: change.id,
          });
        },
      });
    await withMediaService(instanceId, async (media) => {
      const previous = await media.listReferencesByTarget(
        instanceId,
        'vouchers.voucher',
        change.previousId
      );
      if (!previous.length) return;
      const next = await media.listReferencesByTarget(instanceId, 'vouchers.voucher', change.id);
      if (next.length) throw new Error('voucher_identity_conflict');
      // Both replacements use the same instance transaction, retaining reference IDs.
      await media.replaceReferences({
        instanceId,
        targetType: 'vouchers.voucher',
        targetId: change.previousId,
        references: [],
      });
      await media.replaceReferences({
        instanceId,
        targetType: 'vouchers.voucher',
        targetId: change.id,
        references: previous.map((reference) => ({ ...reference, targetId: change.id })),
      });
    });
  }
}
export async function authorizeVoucherMedia(
  ctx: AuthenticatedRequestContext,
  media: readonly Readonly<{
    hostMediaAssetId?: string;
  }>[],
  previousIds: readonly string[],
  targetId?: string
) {
  const ids = [
    ...new Set(media.flatMap((item) => (item.hostMediaAssetId ? [item.hostMediaAssetId] : []))),
  ];
  if (JSON.stringify([...ids].sort()) === JSON.stringify([...new Set(previousIds)].sort()))
    return null;
  const manage = await authorizeMediaPrimitiveForUser({
    ctx,
    action: 'media.reference.manage',
    resource: { targetType: 'vouchers.voucher', ...(targetId ? { targetId } : {}) },
  });
  if (!manage.ok)
    return errorJson(manage.status, manage.error, manage.message, manage.permissionDenial);
  for (const assetId of ids) {
    const read = await authorizeMediaPrimitiveForUser({
      ctx,
      action: 'media.read',
      resource: { assetId, visibility: 'public' },
    });
    if (!read.ok) return errorJson(read.status, read.error, read.message, read.permissionDenial);
    const asset = await withMediaService(manage.actor.instanceId, (service) =>
      service.getAssetById(manage.actor.instanceId, assetId)
    );
    if (
      !asset ||
      asset.visibility !== 'public' ||
      asset.uploadStatus !== 'processed' ||
      asset.processingStatus !== 'ready' ||
      asset.deletionPending
    )
      return errorJson(409, 'voucher_media_unavailable', 'voucher_media_unavailable');
  }
  return null;
}
export async function syncVoucherMedia(
  instanceId: string,
  targetId: string,
  media: readonly Readonly<{
    hostMediaAssetId?: string;
  }>[],
  previousIds: readonly string[]
) {
  const ids = [
    ...new Set(media.flatMap((item) => (item.hostMediaAssetId ? [item.hostMediaAssetId] : []))),
  ];
  if (JSON.stringify([...ids].sort()) === JSON.stringify([...new Set(previousIds)].sort())) return;
  await withMediaService(instanceId, async (service) => {
    const old = await service.listReferencesByTarget(instanceId, 'vouchers.voucher', targetId);
    const retained = old.filter(
      (reference) => !previousIds.includes(reference.assetId) && !ids.includes(reference.assetId)
    );
    const references = [
      ...retained,
      ...ids.map((assetId, sortOrder) => ({
        id: old.find((ref) => ref.assetId === assetId)?.id ?? randomUUID(),
        assetId,
        role: 'gallery_item',
        targetType: 'vouchers.voucher',
        targetId,
        sortOrder,
      })),
    ];
    await service.replaceReferences({
      instanceId,
      targetType: 'vouchers.voucher',
      targetId,
      references,
    });
  });
}
function existingVoucherIdentities(siblings: readonly Record<string, unknown>[]) {
  return Object.fromEntries(
    siblings.map((item) => {
      const id = item.payload == null ? undefined : raw(item.payload).id;
      return [String(item.id), typeof id === 'string' && id ? id : randomUUID()];
    })
  );
}
