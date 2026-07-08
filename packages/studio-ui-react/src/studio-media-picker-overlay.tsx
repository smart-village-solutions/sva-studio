import React from 'react';

import { Button } from './button.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import { MediaIntakePanel } from './media-intake-panel.js';
import { StudioMediaPickerLibraryPanel } from './studio-media-picker-library-panel.js';
import { StudioMediaPickerReviewPanel } from './studio-media-picker-review-panel.js';
import type {
  StudioMediaPickerAssetDetail,
  StudioMediaPickerAssetSummary,
  StudioMediaPickerMetadataDraft,
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
  StudioMediaPickerReviewSource,
  StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.shared.js';
export type {
  StudioMediaPickerAssetDetail,
  StudioMediaPickerAssetSummary,
  StudioMediaPickerErrorCode,
  StudioMediaPickerMetadataDraft,
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
  StudioMediaPickerReviewSource,
  StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.shared.js';
export { useStudioMediaPickerOverlay } from './use-studio-media-picker-overlay.js';

type StudioMediaPickerOverlayProps = Readonly<{
  open: boolean;
  mode: StudioMediaPickerMode;
  reviewSource: StudioMediaPickerReviewSource;
  assets: readonly StudioMediaPickerAssetSummary[];
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onClose: () => void;
  onChangeMode: (mode: 'library' | 'upload') => void;
  onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
  uploadPhase: StudioMediaPickerUploadPhase;
  onUploadFile: (file: File) => void | Promise<void>;
  isSupportedUploadFile: (file: File) => boolean;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => void;
  onBackFromReview: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  labels: StudioMediaPickerOverlayLabels;
}>;

const StudioMediaPickerModeTabs = ({
  labels,
  mode,
  onChangeMode,
}: Readonly<{
  labels: StudioMediaPickerOverlayLabels['modes'];
  mode: StudioMediaPickerMode;
  onChangeMode: (mode: 'library' | 'upload') => void;
}>) => (
  <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
    <Button type="button" variant={mode === 'library' ? 'default' : 'outline'} onClick={() => onChangeMode('library')}>
      {labels.library}
    </Button>
    <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} onClick={() => onChangeMode('upload')}>
      {labels.upload}
    </Button>
    {mode === 'review' ? (
      <Button type="button" variant="secondary" disabled>
        {labels.review}
      </Button>
    ) : null}
  </div>
);

const StudioMediaPickerOverlayBody = ({
  assets,
  feedbackMessage,
  feedbackTone,
  isAssetSelectable,
  isLoadingReviewAsset,
  isSavingReviewAsset,
  isSupportedUploadFile,
  labels,
  metadataDraft,
  mode,
  onBackFromReview,
  onClose,
  onConfirmSelection,
  onMetadataChange,
  onOpenMediaManagement,
  onSearchValueChange,
  onSelectAsset,
  onUploadFile,
  reviewAsset,
  reviewSource,
  searchValue,
  uploadPhase,
}: Omit<StudioMediaPickerOverlayProps, 'open' | 'onChangeMode'>) => (
  <div className="max-h-[72vh] overflow-y-auto pr-1">
    {mode === 'library' ? (
      <StudioMediaPickerLibraryPanel
        assets={assets}
        isAssetSelectable={isAssetSelectable}
        labels={labels.library}
        onSearchValueChange={onSearchValueChange}
        onSelectAsset={onSelectAsset}
        searchValue={searchValue}
      />
    ) : null}

    {mode === 'upload' ? (
      <MediaIntakePanel
        accept="image/jpeg,image/png,image/webp"
        browseActionLabel={labels.upload.browseAction}
        description={labels.upload.description}
        inputTestId="media-upload-input"
        isSupportedUploadFile={isSupportedUploadFile}
        onFileSelected={(file) => void onUploadFile(file)}
        phase={uploadPhase}
        regionLabel={labels.upload.regionLabel}
        statusMessage={feedbackMessage}
        statusTone={feedbackTone}
        supportLabel={labels.upload.supportLabel}
        title={labels.upload.title}
      />
    ) : null}

    {mode === 'review' ? (
      <StudioMediaPickerReviewPanel
        feedbackMessage={feedbackMessage}
        feedbackTone={feedbackTone}
        isLoadingReviewAsset={isLoadingReviewAsset}
        isSavingReviewAsset={isSavingReviewAsset}
        labels={labels}
        metadataDraft={metadataDraft}
        onBackFromReview={onBackFromReview}
        onClose={onClose}
        onConfirmSelection={onConfirmSelection}
        onMetadataChange={onMetadataChange}
        onOpenMediaManagement={onOpenMediaManagement}
        reviewAsset={reviewAsset}
        reviewSource={reviewSource}
      />
    ) : null}
  </div>
);

export const StudioMediaPickerOverlay = ({
  assets,
  feedbackMessage,
  feedbackTone = 'default',
  isAssetSelectable,
  isLoadingReviewAsset = false,
  isSavingReviewAsset = false,
  isSupportedUploadFile,
  labels,
  metadataDraft,
  mode,
  onBackFromReview,
  onChangeMode,
  onClose,
  onConfirmSelection,
  onMetadataChange,
  onOpenMediaManagement,
  onSearchValueChange,
  onSelectAsset,
  onUploadFile,
  open,
  reviewAsset,
  reviewSource,
  searchValue,
  uploadPhase,
}: StudioMediaPickerOverlayProps) => {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1080px)] max-w-none overflow-hidden">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <StudioMediaPickerModeTabs labels={labels.modes} mode={mode} onChangeMode={onChangeMode} />
        <StudioMediaPickerOverlayBody
          assets={assets}
          feedbackMessage={feedbackMessage}
          feedbackTone={feedbackTone}
          isAssetSelectable={isAssetSelectable}
          isLoadingReviewAsset={isLoadingReviewAsset}
          isSavingReviewAsset={isSavingReviewAsset}
          isSupportedUploadFile={isSupportedUploadFile}
          labels={labels}
          metadataDraft={metadataDraft}
          mode={mode}
          onBackFromReview={onBackFromReview}
          onClose={onClose}
          onConfirmSelection={onConfirmSelection}
          onMetadataChange={onMetadataChange}
          onOpenMediaManagement={onOpenMediaManagement}
          onSearchValueChange={onSearchValueChange}
          onSelectAsset={onSelectAsset}
          onUploadFile={onUploadFile}
          reviewAsset={reviewAsset}
          reviewSource={reviewSource}
          searchValue={searchValue}
          uploadPhase={uploadPhase}
        />
      </DialogContent>
    </Dialog>
  );
};
