export type StudioMediaPickerMode = 'library' | 'upload' | 'review';
export type StudioMediaPickerReviewSource = 'library' | 'upload';
export type StudioMediaPickerUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';
export type StudioMediaPickerErrorCode =
  | 'unsupported_upload_type'
  | 'upload_failed'
  | 'asset_load_failed'
  | 'asset_unavailable'
  | 'metadata_save_failed';

export type StudioMediaPickerMetadataDraft = Readonly<{
  title: string;
  altText: string;
  description: string;
  copyright: string;
  license: string;
}>;

export type StudioMediaPickerMetadataUpdate = Readonly<{
  [Key in keyof StudioMediaPickerMetadataDraft]: string | null;
}>;

export type StudioMediaPickerAssetSummary = Readonly<{
  id: string;
  title: string;
  fileName: string;
  previewUrl?: string | null;
  mimeType?: string;
  visibility?: string;
}>;

export type StudioMediaPickerAssetDetail = StudioMediaPickerAssetSummary & Readonly<{
  metadata: StudioMediaPickerMetadataDraft;
}>;

export type StudioMediaPickerOverlayLabels = Readonly<{
  title: string;
  description: string;
  modes: Readonly<{
    library: string;
    upload: string;
    review: string;
  }>;
  library: Readonly<{
    searchLabel: string;
    empty: string;
    select: string;
  }>;
  upload: Readonly<{
    regionLabel: string;
    title: string;
    description: string;
    browseAction: string;
    supportLabel: string;
  }>;
  review: Readonly<{
    title: string;
    description: string;
  }>;
  fields: Readonly<{
    title: string;
    altText: string;
    description: string;
    copyright: string;
    license: string;
  }>;
  actions: Readonly<{
    cancel: string;
    backToLibrary: string;
    backToUpload: string;
    openMediaManagement: string;
    useMedia: string;
  }>;
}>;

export const createMetadataDraft = (
  asset: Pick<StudioMediaPickerAssetDetail, 'metadata' | 'title'>
): StudioMediaPickerMetadataDraft => ({
  title: asset.metadata.title || asset.title || '',
  altText: asset.metadata.altText || '',
  description: asset.metadata.description || '',
  copyright: asset.metadata.copyright || '',
  license: asset.metadata.license || '',
});

export const metadataDraftsMatch = (
  left: StudioMediaPickerMetadataDraft,
  right: StudioMediaPickerMetadataDraft
) => Object.keys(left).every((key) => left[key as keyof StudioMediaPickerMetadataDraft] === right[key as keyof StudioMediaPickerMetadataDraft]);

export const toMetadataUpdate = (draft: StudioMediaPickerMetadataDraft): StudioMediaPickerMetadataUpdate =>
  Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, value.trim() || null])
  ) as StudioMediaPickerMetadataUpdate;

export const normalizeStudioMediaPickerSearchValue = (value: string) => value.trim().toLocaleLowerCase('de-DE');

export const studioMediaPickerPreviewClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20';
