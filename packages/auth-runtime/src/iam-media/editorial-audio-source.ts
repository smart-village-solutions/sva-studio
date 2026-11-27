import { isPersistableManualMediaUrl } from '@sva/core';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { isMediaAssetReady } from './asset-support.js';
import { withMediaService } from './repository.js';
import { authorizeMediaPrimitiveForUser } from './server-authorization.js';
import type { MediaService } from './service.js';
import {
  resolveMediaStorageConfig,
  resolveMediaStorageConfigFromInterface,
} from './storage-s3-config.js';

type EditorialAudioSourceInput = Readonly<{
  request: Request;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  targetType: string;
  targetId?: string;
  urls: readonly string[];
}>;

const managedStorageKey = (url: URL, publicBaseUrl: string | undefined): string | undefined => {
  if (!publicBaseUrl) return undefined;
  const base = new URL(publicBaseUrl);
  const pathPrefix = `${base.pathname.replace(/\/$/u, '')}/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(pathPrefix) || url.search || url.hash)
    return undefined;
  return url.pathname.slice(pathPrefix.length);
};

const managedAudioOutputPath = /\/variants\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.mp3$/iu;
const operationIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;

const readManagedAudioKeys = async (instanceId: string, urls: readonly string[]) => {
  const interfaceStorage = await resolveMediaStorageConfigFromInterface(instanceId);
  const sharedStorage = resolveMediaStorageConfig();
  const effectiveStorage = interfaceStorage ?? sharedStorage;
  const managedHosts = new Set(
    [interfaceStorage, sharedStorage].flatMap((storage) =>
      storage
        ? [storage.endpoint, storage.publicBaseUrl].flatMap((base) =>
            base ? [new URL(base).hostname] : []
          )
        : []
    )
  );
  const storageKeys = new Set<string>();
  for (const source of urls) {
    const url = new URL(source);
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return null;
    }
    if (pathname.startsWith('/api/v1/iam/media/')) return null;
    if (!managedHosts.has(url.hostname) && !managedAudioOutputPath.test(pathname)) continue;
    const storageKey = managedStorageKey(url, effectiveStorage?.publicBaseUrl);
    if (!storageKey?.startsWith(`${instanceId}/`)) return null;
    storageKeys.add(storageKey);
  }
  return storageKeys;
};

type MediaAsset = NonNullable<Awaited<ReturnType<MediaService['getAssetByStorageKey']>>>;

const belongsToActor = (asset: MediaAsset, operationId: string, actorSubject: string) =>
  asset.lifecycleStatus === 'active' ||
  (asset.lifecycleStatus === 'provisional' &&
    asset.provisionalOperationId === operationId &&
    asset.provisionalOwnerSubject === actorSubject);

const readEligibleAssets = async (
  input: EditorialAudioSourceInput,
  storageKeys: ReadonlySet<string>,
  operationId: string
): Promise<readonly MediaAsset[] | null> =>
  withMediaService(input.instanceId, async (service) => {
    const assets: MediaAsset[] = [];
    for (const storageKey of storageKeys) {
      const asset = await service.getAssetByStorageKey(input.instanceId, storageKey);
      if (
        !asset ||
        !isMediaAssetReady(asset) ||
        asset.mediaType !== 'audio' ||
        asset.visibility !== 'public' ||
        asset.technical?.scanStatus !== 'clean'
      )
        return null;
      if (!belongsToActor(asset, operationId, input.ctx.user.id)) return null;
      assets.push(asset);
    }
    return assets;
  });

export const canUseEditorialAudioSources = async (
  input: EditorialAudioSourceInput
): Promise<boolean> => {
  const { request, ctx, instanceId, targetType, targetId, urls } = input;
  if (urls.length === 0) return true;
  if (urls.some((source) => !isPersistableManualMediaUrl(source))) return false;

  const storageKeys = await readManagedAudioKeys(instanceId, urls);
  if (!storageKeys) return false;
  if (storageKeys.size === 0) return true;
  const operationId = request.headers.get('X-SVA-Content-Media-Save-Operation-Id')?.trim();
  if (!operationId || !operationIdPattern.test(operationId)) return false;

  const permissions = await authorizeMediaPrimitiveForUser({
    ctx,
    instanceId,
    action: 'media.reference.manage',
    resource: { targetType, targetId },
  });
  if (!permissions.ok) return false;

  const assets = await readEligibleAssets(input, storageKeys, operationId);
  if (!assets) return false;
  for (const asset of assets) {
    const read = await authorizeMediaPrimitiveForUser({
      ctx,
      instanceId,
      action: 'media.read',
      resource: { assetId: asset.id, visibility: asset.visibility },
    });
    if (!read.ok) return false;
  }
  return withMediaService(instanceId, (service) =>
    service.claimEditorialMediaWrite({
      instanceId,
      operationId,
      actorSubject: ctx.user.id,
      targetType,
      targetId,
      assetIds: assets.map((asset) => asset.id),
    })
  );
};
