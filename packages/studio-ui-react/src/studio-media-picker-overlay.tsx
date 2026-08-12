import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import { MediaIntakePanel } from './media-intake-panel.js';
import { StudioMediaPickerLibraryPanel } from './studio-media-picker-library-panel.js';
import { StudioMediaPickerModeActions } from './studio-media-picker-mode-actions.js';
import { StudioMediaPickerReviewPanel } from './studio-media-picker-review-panel.js';
import type {
  StudioMediaPickerAssetDetail,
  StudioMediaPickerAssetSummary,
  StudioMediaPickerMetadataDraft,
  StudioMediaPickerMetadataField,
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
  StudioMediaPickerMetadataField,
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
  onAddManual: () => string | void;
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
  visibleMetadataFields?: readonly StudioMediaPickerMetadataField[];
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  labels: StudioMediaPickerOverlayLabels;
  canUpload?: boolean;
}>;

const StudioMediaPickerOverlayBody = ({
  assets,
  feedbackMessage,
  feedbackTone,
  isAssetSelectable,
  isLoadingReviewAsset,
  isSavingReviewAsset,
  isMetadataEditable,
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
  visibleMetadataFields,
}: Omit<StudioMediaPickerOverlayProps, 'open' | 'onChangeMode' | 'onAddManual'>) => (
  <div className="max-h-[72vh] overflow-y-auto pr-1">
    {mode === 'library' ? (
      <StudioMediaPickerLibraryPanel
        assets={assets}
        isLoadingReviewAsset={isLoadingReviewAsset}
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
        isMetadataEditable={isMetadataEditable}
        labels={labels}
        metadataDraft={metadataDraft}
        onBackFromReview={onBackFromReview}
        onClose={onClose}
        onConfirmSelection={onConfirmSelection}
        onMetadataChange={onMetadataChange}
        onOpenMediaManagement={onOpenMediaManagement}
        reviewAsset={reviewAsset}
        reviewSource={reviewSource}
        visibleMetadataFields={visibleMetadataFields}
      />
    ) : null}
  </div>
);

export const StudioMediaPickerOverlay = ({
  assets,
  canUpload = true,
  feedbackMessage,
  feedbackTone = 'default',
  isAssetSelectable,
  isLoadingReviewAsset = false,
  isSavingReviewAsset = false,
  isMetadataEditable = true,
  labels,
  metadataDraft,
  mode,
  onAddManual,
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
  visibleMetadataFields,
}: StudioMediaPickerOverlayProps) => {
  const isUploadBusy =
    uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';
  const isBusy = isLoadingReviewAsset || isSavingReviewAsset || isUploadBusy;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !isBusy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1080px)] max-w-none overflow-hidden">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <StudioMediaPickerModeActions
          canUpload={canUpload}
          disabled={isBusy}
          labels={labels.modes}
          mode={mode}
          onAddManual={onAddManual}
          onChangeMode={onChangeMode}
          onClose={onClose}
        />
        <StudioMediaPickerOverlayBody
          assets={assets}
          feedbackMessage={feedbackMessage}
          feedbackTone={feedbackTone}
          isAssetSelectable={isAssetSelectable}
          isLoadingReviewAsset={isLoadingReviewAsset}
          isSavingReviewAsset={isSavingReviewAsset}
          isMetadataEditable={isMetadataEditable}
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
          visibleMetadataFields={visibleMetadataFields}
        />
      </DialogContent>
    </Dialog>
  );
};
