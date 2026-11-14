import type { StudioMediaPickerLibraryPanelProps } from './studio-media-picker-library-panel.js';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import type { MediaEditorialMetadataPatch, MediaFocusPoint } from '@sva/media';
import type {
  HostMediaUploadMetadata,
  HostMediaEditingUpload,
} from '@sva/plugin-sdk/content-media';
export type StudioMediaPickerMode = 'library' | 'upload' | 'review';
export type StudioMediaPickerReviewSource = 'library' | 'upload';
export type StudioMediaPickerUploadPhase =
  'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';
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
export type StudioMediaPickerMetadataField = keyof StudioMediaPickerMetadataDraft;

export type StudioMediaPickerAssetSummary = Readonly<{
  id: string;
  title: string;
  fileName: string;
  previewUrl?: string | null;
  mimeType?: string;
  visibility?: string;
}>;

export type StudioMediaPickerAssetDetail = StudioMediaPickerAssetSummary &
  Readonly<{
    instanceId?: string;
    metadata: StudioMediaPickerMetadataDraft & { tags?: readonly string[] };
    centralMetadata?: StudioMediaPickerMetadataDraft;
    hasEditingDocument?: boolean;
    persistentUrl?: string | null;
    localDraft?: Readonly<{
      id: string;
      file: File;
      metadata?: HostMediaUploadMetadata;
      editing?: HostMediaEditingUpload;
    }>;
  }>;

export type StudioMediaPickerOverlayLabels = Readonly<{
  title: string;
  description: string;
  modes: Readonly<{
    library: string;
    upload: string;
    manual: string;
    review: string;
  }>;
  library: Readonly<{
    searchLabel: string;
    tagLabel?: string;
    loadError?: string;
    loading?: string;
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

export const normalizeStudioMediaPickerSearchValue = (value: string) =>
  value.trim().toLocaleLowerCase('de-DE');

export const studioMediaPickerPreviewClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20';

export type StudioMediaPickerOverlayProps = Readonly<{
  libraryStatus?: StudioMediaPickerLibraryPanelProps['libraryStatus'];
  onWorkspaceDirtyChange?: (dirty: boolean) => void;
  open: boolean;
  mode: StudioMediaPickerMode;
  reviewSource: StudioMediaPickerReviewSource;
  assets: readonly StudioMediaPickerAssetSummary[];
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onClose: () => void;
  onChangeMode: (mode: 'library' | 'upload') => void;
  onAddManual?: (persistentUrl?: string) => string | void;
  onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
  uploadPhase: StudioMediaPickerUploadPhase;
  onUploadFile: (file: File) => void | Promise<void>;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: <Key extends keyof StudioMediaPickerMetadataDraft>(
    key: Key,
    value: StudioMediaPickerMetadataDraft[Key]
  ) => void;
  onBackFromReview: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  isMetadataEditable?: boolean;
  canConfirmSelection?: boolean;
  initialEditorOpen?: boolean;
  isUploadInitialized?: boolean;
  persistenceContext?: 'content' | 'library' | 'settings';
  canEditCentralMetadata?: boolean;
  onImageFocusChange?: (focus: MediaFocusPoint) => void;
  onApplyImageEdit?: (result: StudioMediaImageEdit) => void | Promise<void>;
  onSaveCentralMetadata?: (metadata: MediaEditorialMetadataPatch) => Promise<boolean>;
  visibleMetadataFields?: readonly StudioMediaPickerMetadataField[];
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  labels: StudioMediaPickerOverlayLabels;
  canUpload?: boolean;
}>;
