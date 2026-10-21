import type { MediaService } from './service.js';

export const canAccessMediaAsset = (
  asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>,
  actorSubject: string
): boolean =>
  asset.lifecycleStatus !== 'provisional' || asset.provisionalOwnerSubject === actorSubject;

export const isMediaAssetReady = (asset: { readonly uploadStatus: string; readonly processingStatus: string }): boolean =>
  asset.uploadStatus === 'processed' && asset.processingStatus === 'ready';
