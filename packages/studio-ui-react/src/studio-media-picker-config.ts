import type {
  StudioMediaPickerErrorCode,
  StudioMediaPickerOverlayLabels,
  StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.js';

type TranslateMediaPickerKey = (key: string) => string;

export const createStudioMediaPickerLabels = (
  translate: TranslateMediaPickerKey,
  input: Readonly<{ titleFieldKey?: string }> = {}
): StudioMediaPickerOverlayLabels => ({
  title: translate('messages.mediaPickerTitle'),
  description: translate('messages.mediaPickerDescription'),
  modes: {
    library: translate('messages.mediaPickerLibraryAction'),
    upload: translate('actions.uploadMedia'),
    manual: translate('messages.mediaPickerLinkAction'),
    review: translate('messages.mediaPickerReviewMode'),
  },
  library: {
    searchLabel: translate('fields.imageSearch'),
    empty: translate('messages.imagePickerEmpty'),
    select: translate('actions.selectImage'),
  },
  upload: {
    regionLabel: translate('messages.mediaPickerUploadRegionLabel'),
    title: translate('messages.mediaPickerUploadTitle'),
    description: translate('messages.mediaPickerUploadDescription'),
    browseAction: translate('messages.mediaPickerSelectFile'),
    supportLabel: translate('messages.mediaPickerUploadSupportLabel'),
  },
  review: {
    title: translate('messages.mediaPickerReviewTitle'),
    description: translate('messages.mediaPickerReviewDescription'),
  },
  fields: {
    title: translate(input.titleFieldKey ?? 'fields.title'),
    altText: translate('messages.mediaPickerAltText'),
    description: translate('fields.description'),
    copyright: translate('fields.mediaCopyright'),
    license: translate('messages.mediaPickerLicense'),
  },
  actions: {
    cancel: translate('actions.back'),
    backToLibrary: translate('messages.mediaPickerBackToLibrary'),
    backToUpload: translate('messages.mediaPickerBackToUpload'),
    openMediaManagement: translate('messages.mediaPickerOpenMediaManagement'),
    useMedia: translate('messages.mediaPickerUseMedia'),
  },
});

const uploadPhaseMessageKey = (phase: StudioMediaPickerUploadPhase): string | null => {
  switch (phase) {
    case 'initializing':
      return 'messages.mediaUploadInitializing';
    case 'uploading':
      return 'messages.mediaUploadUploading';
    case 'finalizing':
      return 'messages.mediaUploadFinalizing';
    case 'success':
      return 'messages.mediaUploadSuccess';
    case 'error':
      return 'messages.mediaUploadError';
    case 'idle':
      return null;
  }
};

const errorMessageKeys = {
  unsupported_upload_type: 'messages.mediaUploadUnsupportedType',
  upload_failed: 'messages.mediaUploadError',
  asset_load_failed: 'messages.mediaPickerAssetLoadError',
  asset_unavailable: 'messages.mediaUploadUnavailableUrl',
  metadata_save_failed: 'messages.mediaPickerMetadataSaveError',
} as const satisfies Partial<Record<StudioMediaPickerErrorCode, string>>;

export const resolveStudioMediaPickerFeedback = (
  translate: TranslateMediaPickerKey,
  errorCode: StudioMediaPickerErrorCode | null,
  uploadPhase: StudioMediaPickerUploadPhase
): Readonly<{ message: string | null; tone: 'default' | 'success' | 'error' }> => {
  const errorMessageKey = errorCode ? errorMessageKeys[errorCode] : undefined;
  if (errorMessageKey) return { message: translate(errorMessageKey), tone: 'error' };

  const phaseMessageKey = uploadPhaseMessageKey(uploadPhase);
  return {
    message: phaseMessageKey ? translate(phaseMessageKey) : null,
    tone: uploadPhase === 'success' ? 'success' : 'default',
  };
};
