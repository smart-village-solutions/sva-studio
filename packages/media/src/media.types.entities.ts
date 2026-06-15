import type {
  MediaFormat,
  MediaMetadata,
  MediaProcessingStatus,
  MediaRole,
  MediaTechnicalMetadata,
  MediaType,
  MediaUploadStatus,
  MediaVisibility,
} from './media.types.core.js';

export interface MediaAsset {
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
}

export interface MediaVariant {
  id: string;
  assetId: string;
  variantKey: string;
  presetKey: string;
  format: MediaFormat;
  width: number;
  height?: number;
  storageKey: string;
  generationStatus: 'pending' | 'ready' | 'failed';
}

export interface MediaReference {
  id: string;
  assetId: string;
  targetType: string;
  targetId: string;
  role: MediaRole;
  sortOrder?: number;
}

export interface MediaPreset {
  key: 'thumbnail' | 'teaser' | 'hero';
  width: number;
  height?: number;
  format: MediaFormat;
}

export interface MediaDeletionDecision {
  allowed: boolean;
  reason: 'active_references' | 'legal_hold' | 'upload_incomplete' | null;
}
