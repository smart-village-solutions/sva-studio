export const mediaLiterals = {
  types: ['image'],
  visibilities: ['public', 'protected'],
  uploadStatuses: ['pending', 'validated', 'processed', 'failed', 'blocked'],
  processingStatuses: ['pending', 'ready', 'failed'],
  roles: ['thumbnail', 'teaser_image', 'header_image', 'gallery_item', 'download', 'hero_image'],
  formats: ['jpeg', 'png', 'webp'],
} as const;

export type MediaType = (typeof mediaLiterals.types)[number];
export type MediaVisibility = (typeof mediaLiterals.visibilities)[number];
export type MediaUploadStatus = (typeof mediaLiterals.uploadStatuses)[number];
export type MediaProcessingStatus = (typeof mediaLiterals.processingStatuses)[number];
export type MediaRole = (typeof mediaLiterals.roles)[number];
export type MediaFormat = (typeof mediaLiterals.formats)[number];

export interface MediaFocusPoint {
  x: number;
  y: number;
}

export interface MediaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaMetadata {
  title?: string;
  description?: string;
  altText?: string;
  copyright?: string;
  license?: string;
  focusPoint?: MediaFocusPoint;
  crop?: MediaCrop;
}

export interface MediaTechnicalMetadata {
  width?: number;
  height?: number;
  durationMs?: number;
  pageCount?: number;
}
