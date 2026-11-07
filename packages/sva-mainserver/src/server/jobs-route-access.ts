import { randomUUID } from 'node:crypto';
import {
  authorizeContentPrimitiveForUser,
  authorizeMediaPrimitiveForUser,
  withMediaService,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { JOBS_TYPE, type JobInput, type JobRecord } from './jobs-contract.js';
import { errorJson } from './content-route-core.js';
import type { MainserverMutationActor } from './mutation-principal.js';

export const jobLocalAccess = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentId?: string
) => {
  const decision = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: { contentType: JOBS_TYPE, ...(contentId ? { contentId } : {}) },
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

export async function authorizeJobMedia(
  ctx: AuthenticatedRequestContext,
  job: JobInput,
  previousIds: readonly string[],
  targetId?: string
) {
  const oldIds = [...new Set(previousIds)];
  const ids = [
    ...new Set(
      job.mediaContents.flatMap((item) => (item.hostMediaAssetId ? [item.hostMediaAssetId] : []))
    ),
  ];
  if (JSON.stringify(ids) === JSON.stringify(oldIds)) return null;
  const manage = await authorizeMediaPrimitiveForUser({
    ctx,
    action: 'media.reference.manage',
    resource: { targetType: JOBS_TYPE, ...(targetId ? { targetId } : {}) },
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
      asset.lifecycleStatus === 'provisional' ||
      asset.deletionPending
    )
      return errorJson(409, 'job_media_unavailable', 'job_media_unavailable');
  }
  return null;
}

export async function syncJobMedia(
  actor: MainserverMutationActor,
  data: JobRecord,
  previousIds: readonly string[]
) {
  const ids = [
    ...new Set(
      data.input.mediaContents.flatMap((item) =>
        item.hostMediaAssetId ? [item.hostMediaAssetId] : []
      )
    ),
  ];
  if (JSON.stringify(ids) === JSON.stringify(previousIds)) return;
  await withMediaService(actor.instanceId, async (service) => {
    const old = await service.listReferencesByTarget(actor.instanceId, JOBS_TYPE, data.id);
    const retained = old.filter(
      (reference) => !previousIds.includes(reference.assetId) && !ids.includes(reference.assetId)
    );
    await service.replaceReferences({
      instanceId: actor.instanceId,
      targetType: JOBS_TYPE,
      targetId: data.id,
      references: [
        ...retained,
        ...ids.map((assetId, sortOrder) => ({
          id: old.find((item) => item.assetId === assetId)?.id ?? randomUUID(),
          assetId,
          role: 'gallery_item',
          targetType: JOBS_TYPE,
          targetId: data.id,
          sortOrder,
        })),
      ],
    });
  });
}
