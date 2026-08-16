import { Button, StudioMediaPickerOverlay } from '@sva/studio-ui-react';
import type { StudioMediaPickerOverlayLabels } from '@sva/studio-ui-react';

import {
  toMediaPickerSummary,
  useWasteBrandingMediaController,
} from './waste-management.output-branding-media.logic.js';
import type { WasteOutputTranslate } from './waste-management.output-branding-media.js';

type BrandingMediaController = ReturnType<typeof useWasteBrandingMediaController>;

export const BrandingPreview = ({
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

const MediaLibraryLoadError = ({
  controller,
  translate,
}: Readonly<{
  controller: BrandingMediaController;
  translate: WasteOutputTranslate;
}>) =>
  controller.mediaLibraryError ? (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground"
      role="alert"
    >
      <span>{translate('output.pdf.mediaPicker.libraryLoadFailed')}</span>
      <Button
        type="button"
        variant="secondary"
        disabled={controller.isMediaLibraryLoading}
        onClick={() => void controller.retryMediaLibrary()}
      >
        {translate(
          controller.isMediaLibraryLoading
            ? 'output.pdf.mediaPicker.retryingLibrary'
            : 'output.pdf.mediaPicker.retryLibrary'
        )}
      </Button>
    </div>
  ) : null;

export const BrandingMediaPickerControls = ({
  controller,
  feedback,
  labels,
  translate,
}: Readonly<{
  controller: BrandingMediaController;
  feedback: Readonly<{ message: string | null; tone: 'default' | 'error' | 'success' }>;
  labels: StudioMediaPickerOverlayLabels;
  translate: WasteOutputTranslate;
}>) => {
  const { mediaAssets, mediaCapabilities, mediaLibraryError, mediaPicker } = controller;
  return (
    <>
      <MediaLibraryLoadError controller={controller} translate={translate} />
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
    </>
  );
};
