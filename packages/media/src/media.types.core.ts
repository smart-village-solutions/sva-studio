export const mediaTypes = ['image'] as const;
export type MediaType = (typeof mediaTypes)[number];

export const mediaVisibilities = ['public', 'protected'] as const;
export type MediaVisibility = (typeof mediaVisibilities)[number];

export const mediaUploadStatuses = ['pending', 'validated', 'processed', 'failed', 'blocked'] as const;
export type MediaUploadStatus = (typeof mediaUploadStatuses)[number];

export const mediaProcessingStatuses = ['pending', 'ready', 'failed'] as const;
export type MediaProcessingStatus = (typeof mediaProcessingStatuses)[number];

export const mediaRoles = [
  'thumbnail',
  'teaser_image',
  'header_image',
  'gallery_item',
  'download',
  'hero_image',
] as const;
export type MediaRole = (typeof mediaRoles)[number];

export const mediaFormats = ['jpeg', 'png', 'webp'] as const;
export type MediaFormat = (typeof mediaFormats)[number];

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
