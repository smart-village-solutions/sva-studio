import { StudioConfirmDialog } from './studio-confirm-dialog.js';
import { createMetadataDraft } from './studio-media-picker-overlay.shared.js';
import * as React from 'react';
import { useStudioEditorLeaveGuard } from './studio-editor-leave-guard.js';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import type { MediaEditorialMetadataPatch, MediaFocusPoint } from '@sva/media';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import { MediaIntakePanel } from './media-intake-panel.js';
import {
  StudioMediaPickerLibraryPanel,
  type StudioMediaPickerLibraryPanelProps,
} from './studio-media-picker-library-panel.js';
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
export { createLocalStudioMediaPickerAsset } from './studio-media-picker-local-asset.js';

type StudioMediaPickerOverlayProps = Readonly<{
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

const StudioMediaPickerOverlayBody = (
  props: Omit<StudioMediaPickerOverlayProps, 'open' | 'onChangeMode' | 'onAddManual'>
) => {
  const {
    assets,
    feedbackMessage,
    feedbackTone,
    isAssetSelectable,
    isLoadingReviewAsset,
    labels,
    mode,
    onSearchValueChange,
    onSelectAsset,
    onUploadFile,
    searchValue,
    uploadPhase,
  } = props;
  return (
    <div className="max-h-[72vh] overflow-y-auto pr-1">
      {mode !== 'upload' && feedbackMessage ? (
        <p
          role={feedbackTone === 'error' ? 'alert' : 'status'}
          className={
            feedbackTone === 'error'
              ? 'mb-3 text-sm text-destructive'
              : 'mb-3 text-sm text-muted-foreground'
          }
        >
          {feedbackMessage}
        </p>
      ) : null}
      {mode === 'library' ? (
        <StudioMediaPickerLibraryPanel
          assets={assets}
          libraryStatus={props.libraryStatus}
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

      {mode === 'review' ? <StudioMediaPickerReviewPanel {...props} /> : null}
    </div>
  );
};

const useMediaCloseGuard = (
  props: StudioMediaPickerOverlayProps,
  workspaceDirty: boolean,
  onConfirm: () => void
) => {
  const dirty =
    workspaceDirty ||
    Boolean(props.reviewAsset?.localDraft) ||
    Boolean(
      props.reviewAsset &&
      JSON.stringify(createMetadataDraft(props.reviewAsset)) !== JSON.stringify(props.metadataDraft)
    );
  const close = () => {
    if (dirty) onConfirm();
    else props.onClose();
  };
  React.useEffect(() => {
    if (!props.open || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, props.open]);
  return close;
};

export const StudioMediaPickerOverlay = (props: StudioMediaPickerOverlayProps) => {
  const {
    canUpload = true,
    isLoadingReviewAsset = false,
    isSavingReviewAsset = false,
    labels,
    mode,
    onAddManual,
    onChangeMode,
    onClose,
    open,
    uploadPhase,
  } = props;
  const t = useContentMediaTranslation();
  useStudioEditorLeaveGuard({ enabled: open, hasUnsavedChanges: open });
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [workspaceDirty, setWorkspaceDirty] = React.useState(false);
  React.useEffect(() => {
    if (!open) setWorkspaceDirty(false);
  }, [open]);
  const close = useMediaCloseGuard(props, workspaceDirty, () => setConfirmDiscard(true));
  const isUploadBusy =
    uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';
  const isBusy = isLoadingReviewAsset || isSavingReviewAsset || isUploadBusy;
  const visibleMode = !canUpload && mode === 'upload' ? 'library' : mode;

  return (
    <>
      <StudioConfirmDialog
        open={open && confirmDiscard}
        title={t('editor.discardChanges')}
        description={t('editor.discardHint')}
        confirmLabel={t('editor.discardAction')}
        cancelLabel={t('editor.keepEditing')}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !isBusy ? close() : undefined)}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,1080px)] max-w-none overflow-hidden">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          {visibleMode !== 'review' ? (
            <StudioMediaPickerModeActions
              canUpload={canUpload}
              disabled={isBusy}
              labels={labels.modes}
              mode={visibleMode}
              onAddManual={onAddManual}
              onChangeMode={onChangeMode}
              onClose={onClose}
            />
          ) : null}
          <StudioMediaPickerOverlayBody
            {...props}
            onClose={close}
            {...(props.isUploadInitialized
              ? {
                  isMetadataEditable: false,
                  onApplyImageEdit: undefined,
                  onSaveCentralMetadata: undefined,
                }
              : {})}
            onWorkspaceDirtyChange={setWorkspaceDirty}
            mode={visibleMode}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
