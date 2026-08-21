import {
  mediaLiterals,
  type MediaAsset,
  type MediaProcessingStatus,
  type MediaReference,
  type MediaRole,
  type MediaUploadStatus,
  type MediaVisibility,
} from '@sva/media';

import type { MediaService } from './service.js';

export const isGeneratedVariantStorageKey = (instanceId: string, storageKey: string): boolean => {
  const segments = storageKey.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return false;
  }

  if (segments[0] === 'variants') {
    return true;
  }

  return segments[0] === instanceId && segments[1] === 'variants';
};

const MEDIA_VISIBILITIES = new Set<string>(mediaLiterals.visibilities);
const MEDIA_UPLOAD_STATUSES = new Set<string>(mediaLiterals.uploadStatuses);
const MEDIA_PROCESSING_STATUSES = new Set<string>(mediaLiterals.processingStatuses);
const MEDIA_ROLES = new Set<string>(mediaLiterals.roles);

export const isMediaVisibility = (value: string): value is MediaVisibility =>
  MEDIA_VISIBILITIES.has(value);
const isMediaUploadStatus = (value: string): value is MediaUploadStatus =>
  MEDIA_UPLOAD_STATUSES.has(value);
const isMediaProcessingStatus = (value: string): value is MediaProcessingStatus =>
  MEDIA_PROCESSING_STATUSES.has(value);
const isMediaRole = (value: string): value is MediaRole => MEDIA_ROLES.has(value);

export class InvalidPersistedMediaVisibilityError extends Error {
  constructor(
    readonly assetId: string,
    readonly visibility: string
  ) {
    super(`Unsupported persisted media visibility "${visibility}" for asset "${assetId}".`);
    this.name = 'InvalidPersistedMediaVisibilityError';
  }
}

const asMediaVisibility = (value: string): MediaVisibility =>
  isMediaVisibility(value) ? value : 'public';

const asMediaUploadStatus = (value: string): MediaUploadStatus =>
  isMediaUploadStatus(value) ? value : 'failed';

const asMediaProcessingStatus = (value: string): MediaProcessingStatus =>
  isMediaProcessingStatus(value) ? value : 'failed';

const asMediaRole = (value: string): MediaRole => (isMediaRole(value) ? value : 'download');

export const asMediaAsset = (
  asset: Awaited<ReturnType<MediaService['getAssetById']>>
): MediaAsset | null => {
  if (!asset) {
    return null;
  }
  return {
    ...asset,
    mediaType: 'image',
    visibility: asMediaVisibility(asset.visibility),
    uploadStatus: asMediaUploadStatus(asset.uploadStatus),
    processingStatus: asMediaProcessingStatus(asset.processingStatus),
  };
};

export const asMediaReferences = (
  references: readonly Awaited<ReturnType<MediaService['listReferencesByAssetId']>>[number][]
): readonly MediaReference[] =>
  references.map((reference) => ({
    ...reference,
    role: asMediaRole(reference.role),
  }));

export const assertSupportedListAssetVisibility = <T extends { id: string; visibility: string }>(
  asset: T
): T => {
  if (!isMediaVisibility(asset.visibility)) {
    throw new InvalidPersistedMediaVisibilityError(asset.id, asset.visibility);
  }

  return asset;
};
