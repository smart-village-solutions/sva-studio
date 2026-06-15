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
