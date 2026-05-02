export type MediaType = 'image';
export type MediaVisibility = 'public' | 'protected';
export type MediaUploadStatus = 'pending' | 'validated' | 'processed' | 'failed' | 'blocked';
export type MediaProcessingStatus = 'pending' | 'ready' | 'failed';
export type MediaRole = 'thumbnail' | 'teaser_image' | 'header_image' | 'gallery_item' | 'download' | 'hero_image';
export type MediaFormat = 'jpeg' | 'png' | 'webp';

export type MediaFocusPoint = Readonly<{
  x: number;
  y: number;
}>;

export type MediaCrop = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type MediaMetadata = Readonly<{
  title?: string;
  description?: string;
  altText?: string;
  copyright?: string;
  license?: string;
  focusPoint?: MediaFocusPoint;
  crop?: MediaCrop;
}>;

export type MediaTechnicalMetadata = Readonly<{
  width?: number;
  height?: number;
  durationMs?: number;
  pageCount?: number;
}>;

export type MediaAsset = Readonly<{
  id: string;
  instanceId: string;
  storageKey: string;
  mediaType: MediaType;
  mimeType: string;
  byteSize: number;
  visibility: MediaVisibility;
  uploadStatus: MediaUploadStatus;
  processingStatus: MediaProcessingStatus;
  metadata: MediaMetadata;
  technical: MediaTechnicalMetadata;
}>;

export type MediaVariant = Readonly<{
  id: string;
  assetId: string;
  variantKey: string;
  presetKey: string;
  format: MediaFormat;
  width: number;
  height?: number;
  storageKey: string;
  generationStatus: 'pending' | 'ready' | 'failed';
}>;

export type MediaReference = Readonly<{
  id: string;
  assetId: string;
  targetType: string;
  targetId: string;
  role: MediaRole;
  sortOrder?: number;
}>;

export type MediaPreset = Readonly<{
  key: 'thumbnail' | 'teaser' | 'hero';
  width: number;
  height?: number;
  format: MediaFormat;
}>;

export type MediaDeletionDecision = Readonly<{
  allowed: boolean;
  reason: 'active_references' | 'legal_hold' | 'upload_incomplete' | null;
}>;

export const defaultMediaPresets = [
  {
    key: 'thumbnail',
    width: 320,
    height: 320,
    format: 'webp',
  },
  {
    key: 'teaser',
    width: 800,
    height: 450,
    format: 'webp',
  },
  {
    key: 'hero',
    width: 1600,
    height: 900,
    format: 'webp',
  },
] as const satisfies readonly MediaPreset[];

export const canDeleteMediaAsset = (input: {
  readonly asset: MediaAsset;
  readonly references: readonly MediaReference[];
  readonly legalHold?: boolean;
}): MediaDeletionDecision => {
  if (input.references.length > 0) {
    return {
      allowed: false,
      reason: 'active_references',
    };
  }

  if (input.legalHold) {
    return {
      allowed: false,
      reason: 'legal_hold',
    };
  }

  if (input.asset.uploadStatus !== 'processed' || input.asset.processingStatus !== 'ready') {
    return {
      allowed: false,
      reason: 'upload_incomplete',
    };
  }

  return {
    allowed: true,
    reason: null,
  };
};
