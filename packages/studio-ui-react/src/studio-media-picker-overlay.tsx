import { StudioConfirmDialog } from './studio-confirm-dialog.js';
import {
  restoreManualMediaFocus,
  useManualMediaPicker,
  useMediaCloseGuard,
} from './studio-media-picker-overlay-close.js';
import * as React from 'react';
import { useStudioEditorLeaveGuard } from './studio-editor-leave-guard.js';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import { MediaIntakePanel } from './media-intake-panel.js';
import {
  StudioMediaPickerLibraryPanel,
  type StudioMediaPickerLibraryPanelProps,
} from './studio-media-picker-library-panel.js';
import { StudioMediaPickerModeActions } from './studio-media-picker-mode-actions.js';
import { StudioMediaPickerLinkPanel } from './studio-media-picker-link-panel.js';
import {
  StudioMediaPickerReviewPanel,
  type StudioMediaPickerReviewPanelProps,
} from './studio-media-picker-review-panel.js';
import type {
  StudioMediaPickerAssetSummary,
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
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

type StudioMediaPickerOverlayProps = StudioMediaPickerReviewPanelProps &
  Readonly<{
    libraryStatus?: StudioMediaPickerLibraryPanelProps['libraryStatus'];
    open: boolean;
    mode: StudioMediaPickerMode;
    assets: readonly StudioMediaPickerAssetSummary[];
    searchValue: string;
    onSearchValueChange: (value: string) => void;
    onChangeMode: (mode: 'library' | 'upload') => void;
    onAddManual?: (persistentUrl?: string) => string | void;
    onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
    uploadPhase: StudioMediaPickerUploadPhase;
    onUploadFile: (file: File) => void | Promise<void>;
    isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
    labels: StudioMediaPickerOverlayLabels;
    canUpload?: boolean;
    allowAudio?: boolean | 'only';
  }>;

const acceptedUploadTypes = (allowAudio: StudioMediaPickerOverlayProps['allowAudio']) => {
  const images = 'image/jpeg,image/png,image/webp';
  const audio = 'audio/mpeg,.mp3';
  if (allowAudio === 'only') return audio;
  return allowAudio ? `${images},${audio}` : images;
};

const StudioMediaPickerOverlayBody = (
  props: Omit<StudioMediaPickerOverlayProps, 'open' | 'onChangeMode' | 'onAddManual'> & {
    isBusy: boolean;
    manualOpen: boolean;
    manualUrl: string;
    onManualUrlChange: (url: string) => void;
    onConfirmManual: (url: string) => void;
  }
) => {
  if (props.manualOpen)
    return (
      <div className="flex min-h-0 flex-col">
        <StudioMediaPickerLinkPanel
          allowAudio={Boolean(props.allowAudio)}
          value={props.manualUrl}
          onChange={props.onManualUrlChange}
          disabled={props.isBusy}
          onCancel={props.onClose}
          onConfirm={props.onConfirmManual}
        />
      </div>
    );
  return (
    <div
      className={
        props.mode === 'review' ? 'flex min-h-0 flex-1 flex-col' : 'min-h-0 overflow-y-auto pr-1'
      }
    >
      {props.mode !== 'upload' && props.feedbackMessage ? (
        <p
          role={props.feedbackTone === 'error' ? 'alert' : 'status'}
          className={
            props.feedbackTone === 'error'
              ? 'mb-3 text-sm text-destructive'
              : 'mb-3 text-sm text-muted-foreground'
          }
        >
          {props.feedbackMessage}
        </p>
      ) : null}
      {props.mode === 'library' ? (
        <StudioMediaPickerLibraryPanel {...props} labels={props.labels.library} />
      ) : null}

      {props.mode === 'upload' ? (
        <MediaIntakePanel
          accept={acceptedUploadTypes(props.allowAudio)}
          browseActionLabel={props.labels.upload.browseAction}
          description={props.labels.upload.description}
          inputTestId="media-upload-input"
          onFileSelected={(file) => void props.onUploadFile(file)}
          phase={props.uploadPhase}
          regionLabel={props.labels.upload.regionLabel}
          statusMessage={props.feedbackMessage}
          statusTone={props.feedbackTone}
          supportLabel={props.labels.upload.supportLabel}
          title={props.labels.upload.title}
        />
      ) : null}

      {props.mode === 'review' ? (
        <StudioMediaPickerReviewPanel
          {...props}
          {...(props.reviewAsset?.mimeType === 'audio/mpeg'
            ? { onApplyImageEdit: undefined, initialEditorOpen: false }
            : {})}
          {...(props.isUploadInitialized
            ? {
                isMetadataEditable: false,
                onApplyImageEdit: undefined,
                onSaveCentralMetadata: undefined,
              }
            : {})}
        />
      ) : null}
    </div>
  );
};

const MediaPickerDiscardDialog = ({
  open, onCancel, onConfirm,
}: { open: boolean; onCancel: () => void; onConfirm: () => void }) => {
  const t = useContentMediaTranslation();
  return (
    <StudioConfirmDialog
      open={open}
      title={t('editor.discardChanges')}
      description={t('editor.discardHint')}
      confirmLabel={t('editor.discardAction')}
      cancelLabel={t('editor.keepEditing')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

export const StudioMediaPickerOverlay = (props: StudioMediaPickerOverlayProps) => {
  const { labels, open } = props;
  useStudioEditorLeaveGuard({ enabled: open, hasUnsavedChanges: open });
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const { workspaceDirty, setWorkspaceDirty, manualOpen, setManualOpen, manualUrl, setManualUrl, acceptedManualUiId } =
    useManualMediaPicker(open);
  const close = useMediaCloseGuard(props, workspaceDirty, Boolean(manualUrl), () =>
    setConfirmDiscard(true)
  );
  const isBusy = Boolean(
    props.isLoadingReviewAsset ||
    props.isSavingReviewAsset ||
    ['initializing', 'uploading', 'finalizing'].includes(props.uploadPhase)
  );
  const visibleMode = props.canUpload === false && props.mode === 'upload' ? 'library' : props.mode;

  return (
    <>
      <MediaPickerDiscardDialog
        open={open && confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          props.onClose();
        }}
      />
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !isBusy ? close() : undefined)}>
        <DialogContent
          className="flex h-[92dvh] max-h-[92dvh] w-[min(96vw,1280px)] max-w-none flex-col gap-4 overflow-hidden"
          onCloseAutoFocus={(event) => restoreManualMediaFocus(event, acceptedManualUiId)}
        >
          <div id="SfxPopper" />
          <DialogHeader className="shrink-0">
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
          {visibleMode !== 'review' ? (
            <StudioMediaPickerModeActions
              canUpload={props.canUpload !== false}
              disabled={isBusy}
              labels={labels.modes}
              mode={manualOpen ? 'manual' : visibleMode}
              onOpenManual={props.onAddManual ? () => setManualOpen(true) : undefined}
              onChangeMode={(nextMode) => {
                setManualOpen(false);
                props.onChangeMode(nextMode);
              }}
            />
          ) : null}
          <StudioMediaPickerOverlayBody
            {...props}
            isBusy={isBusy}
            onClose={close}
            mode={visibleMode}
            onWorkspaceDirtyChange={setWorkspaceDirty}
            manualOpen={manualOpen}
            manualUrl={manualUrl}
            onManualUrlChange={setManualUrl}
            onConfirmManual={(url) => {
              acceptedManualUiId.current = props.onAddManual?.(url) || null;
              props.onClose();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
