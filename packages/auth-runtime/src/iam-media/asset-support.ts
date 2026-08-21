import type { MediaService } from './service.js';

export const canAccessMediaAsset = (
  asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>,
  actorSubject: string
): boolean =>
  asset.lifecycleStatus !== 'provisional' || asset.provisionalOwnerSubject === actorSubject;
