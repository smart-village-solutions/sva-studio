import { randomUUID } from 'node:crypto';
import {
  authorizeMediaPrimitiveForUser,
  bindExternalContentReference,
  loadExternalContentReferenceBySourceEntity,
  withExternalContentMutationLock,
  withMediaService,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { errorJson } from './content-route-core.js';
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
