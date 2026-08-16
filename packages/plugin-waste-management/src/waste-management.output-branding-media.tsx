import { contentMediaUploadPhaseMessageKey } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  isPersistableContentMediaUrl,
  StudioField,
  StudioMediaPickerOverlay,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
} from '@sva/studio-ui-react';
import { useMemo } from 'react';

import {
  toMediaPickerSummary,
  useWasteBrandingMediaController,
} from './waste-management.output-branding-media.logic.js';

export type WasteOutputTranslate = (
  key: string,
  variables?: Record<string, string | number>
) => string;

const createMediaPickerLabels = (
  translate: WasteOutputTranslate
): StudioMediaPickerOverlayLabels => ({
  title: translate('output.pdf.mediaPicker.title'),
  description: translate('output.pdf.mediaPicker.description'),
  modes: {
    library: translate('output.pdf.mediaPicker.libraryAction'),
    upload: translate('output.pdf.mediaPicker.uploadAction'),
    manual: translate('output.pdf.mediaPicker.manualAction'),
    review: translate('output.pdf.mediaPicker.reviewMode'),
  },
  library: {
    searchLabel: translate('output.pdf.mediaPicker.searchLabel'),
    empty: translate('output.pdf.mediaPicker.empty'),
    select: translate('output.pdf.mediaPicker.select'),
  },
  upload: {
    regionLabel: translate('output.pdf.mediaPicker.uploadRegionLabel'),
    title: translate('output.pdf.mediaPicker.uploadTitle'),
    description: translate('output.pdf.mediaPicker.uploadDescription'),
    browseAction: translate('output.pdf.mediaPicker.selectFile'),
    supportLabel: translate('output.pdf.mediaPicker.uploadSupportLabel'),
  },
  review: {
    title: translate('output.pdf.mediaPicker.reviewTitle'),
    description: translate('output.pdf.mediaPicker.reviewDescription'),
  },
  fields: {
    title: translate('output.pdf.mediaPicker.fields.title'),
    altText: translate('output.pdf.mediaPicker.fields.altText'),
    description: translate('output.pdf.mediaPicker.fields.description'),
    copyright: translate('output.pdf.mediaPicker.fields.copyright'),
    license: translate('output.pdf.mediaPicker.fields.license'),
  },
  actions: {
    cancel: translate('output.pdf.mediaPicker.cancel'),
    backToLibrary: translate('output.pdf.mediaPicker.backToLibrary'),
    backToUpload: translate('output.pdf.mediaPicker.backToUpload'),
    openMediaManagement: translate('output.pdf.mediaPicker.openMediaManagement'),
    useMedia: translate('output.pdf.mediaPicker.useMedia'),
  },
});

const resolvePickerFeedback = (
  translate: WasteOutputTranslate,
  errorCode: StudioMediaPickerErrorCode | null,
  uploadPhase: Parameters<typeof contentMediaUploadPhaseMessageKey>[0]
) => {
  const errorKeyByCode: Partial<Record<StudioMediaPickerErrorCode, string>> = {
    unsupported_upload_type: 'output.pdf.mediaPicker.unsupportedType',
    upload_failed: 'output.pdf.mediaPicker.uploadFailed',
    asset_load_failed: 'output.pdf.mediaPicker.assetLoadFailed',
    asset_unavailable: 'output.pdf.mediaPicker.assetUnavailable',
    metadata_save_failed: 'output.pdf.mediaPicker.metadataSaveFailed',
  };
  const errorKey = errorCode ? errorKeyByCode[errorCode] : undefined;
  if (errorKey) {
    return { message: translate(errorKey), tone: 'error' as const };
  }

  const phaseKey = contentMediaUploadPhaseMessageKey(uploadPhase);
  const phaseMessageKey = phaseKey ? phaseKey.slice(phaseKey.lastIndexOf('.') + 1) : null;
  return phaseKey
    ? {
        message: translate(`output.pdf.mediaPicker.${phaseMessageKey}`),
        tone: uploadPhase === 'success' ? ('success' as const) : ('default' as const),
      }
    : { message: null, tone: 'default' as const };
};

type WasteOutputBrandingMediaFieldProps = {
  readonly error?: string;
  readonly onChange: (value: string) => void;
  readonly translate: WasteOutputTranslate;
  readonly value: string;
};

const BrandingPreview = ({
  onRemove,
  translate,
  value,
}: Readonly<{
  onRemove: () => void;
  translate: WasteOutputTranslate;
  value: string;
}>) => (
  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center">
    <img
      alt={translate('output.pdf.mediaPicker.previewAlt')}
      className="max-h-24 max-w-64 rounded-lg border border-border/60 bg-background object-contain p-2"
      src={value}
    />
    <Button type="button" variant="secondary" onClick={onRemove}>
      {translate('output.pdf.mediaPicker.remove')}
    </Button>
  </div>
);

export const WasteOutputBrandingMediaField = (props: WasteOutputBrandingMediaFieldProps) => {
  const { error, onChange, translate, value } = props;
  const {
    isMediaLibraryLoading,
    mediaAssets,
    mediaCapabilities,
    mediaLibraryError,
    mediaPicker,
    retryMediaLibrary,
  } = useWasteBrandingMediaController(onChange);

  const labels = useMemo(() => createMediaPickerLabels(translate), [translate]);
  const feedback = useMemo(
    () => resolvePickerFeedback(translate, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, translate]
  );
  const hasPreview = isPersistableContentMediaUrl(value);

  return (
    <StudioField
      id="content-media-branding-url"
      label={translate('output.pdf.fields.brandingAssetUrl')}
      description={translate('output.pdf.fieldHints.brandingAssetUrl')}
      error={error}
    >
      <div className="space-y-3">
        {hasPreview ? (
          <BrandingPreview value={value} translate={translate} onRemove={() => onChange('')} />
        ) : null}
        <Input
          id="content-media-branding-url"
          type="url"
          aria-describedby={
            error
              ? 'content-media-branding-url-description content-media-branding-url-error'
              : 'content-media-branding-url-description'
          }
          aria-invalid={error ? true : undefined}
          placeholder={translate('output.pdf.mediaPicker.urlPlaceholder')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {mediaLibraryError ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground"
            role="alert"
          >
            <span>{translate('output.pdf.mediaPicker.libraryLoadFailed')}</span>
            <Button
              type="button"
              variant="secondary"
              disabled={isMediaLibraryLoading}
              onClick={() => void retryMediaLibrary()}
            >
              {translate(
                isMediaLibraryLoading
                  ? 'output.pdf.mediaPicker.retryingLibrary'
                  : 'output.pdf.mediaPicker.retryLibrary'
              )}
            </Button>
          </div>
        ) : null}
        {mediaCapabilities.canSelect ? (
          <Button
            type="button"
            onClick={() =>
              mediaCapabilities.canUpload ? mediaPicker.openUpload() : mediaPicker.openLibrary()
            }
          >
            {translate('output.pdf.mediaPicker.title')}
          </Button>
        ) : null}
        <StudioMediaPickerOverlay
          assets={mediaAssets.map(toMediaPickerSummary)}
          canUpload={mediaCapabilities.canUpload}
          feedbackMessage={
            mediaLibraryError
              ? translate('output.pdf.mediaPicker.libraryLoadFailed')
              : feedback.message
          }
          feedbackTone={mediaLibraryError ? 'error' : feedback.tone}
          isAssetSelectable={(asset) => asset.visibility === 'public'}
          isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
          isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
          isMetadataEditable={mediaCapabilities.canEditAssetMetadata}
          labels={labels}
          metadataDraft={mediaPicker.metadataDraft}
          mode={mediaPicker.mode}
          onAddManual={() => 'branding'}
          onBackFromReview={mediaPicker.goBackFromReview}
          onChangeMode={(mode) =>
            mode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
          }
          onClose={mediaPicker.close}
          onConfirmSelection={() => void mediaPicker.confirmSelection()}
          onMetadataChange={(key, nextValue) => mediaPicker.updateMetadataField(key, nextValue)}
          onSearchValueChange={mediaPicker.setSearchValue}
          onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
          onUploadFile={(file) => void mediaPicker.uploadFile(file)}
          open={mediaPicker.open}
          reviewAsset={mediaPicker.reviewAsset}
          reviewSource={mediaPicker.reviewSource}
          searchValue={mediaPicker.searchValue}
          uploadPhase={mediaPicker.uploadPhase}
        />
      </div>
    </StudioField>
  );
};
