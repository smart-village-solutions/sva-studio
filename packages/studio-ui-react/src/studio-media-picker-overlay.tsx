import { MediaIntakePanel } from './media-intake-panel.js';
import {
  isStudioMediaPickerInteractionLocked,
  StudioMediaPickerOverlayDialog,
} from './studio-media-picker-overlay.dialog.js';
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
  StudioMediaPickerMetadataSaveInput,
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

const StudioMediaPickerOverlayBody = ({
  assets,
  feedbackMessage,
  feedbackTone,
  isAssetSelectable,
  isLoadingReviewAsset,
  isSavingReviewAsset,
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
  const isInteractionLocked = isStudioMediaPickerInteractionLocked(
    uploadPhase,
    isLoadingReviewAsset,
    isSavingReviewAsset
  );

  return (
    <StudioMediaPickerOverlayDialog
      isInteractionLocked={isInteractionLocked}
      labels={labels}
      mode={mode}
      onChangeMode={onChangeMode}
      onClose={onClose}
      open={open}
    >
      <StudioMediaPickerOverlayBody
        assets={assets}
        feedbackMessage={feedbackMessage}
        feedbackTone={feedbackTone}
        isAssetSelectable={isAssetSelectable}
        isLoadingReviewAsset={isLoadingReviewAsset}
        isSavingReviewAsset={isSavingReviewAsset}
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
    </StudioMediaPickerOverlayDialog>
  );
};
