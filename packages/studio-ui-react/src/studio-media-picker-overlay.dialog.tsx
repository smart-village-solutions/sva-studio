import { Button } from './button.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import type {
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
  StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.shared.js';

export const isBusyUploadPhase = (uploadPhase: StudioMediaPickerUploadPhase) =>
  uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';

export const isStudioMediaPickerInteractionLocked = (
  uploadPhase: StudioMediaPickerUploadPhase,
  isLoadingReviewAsset: boolean,
  isSavingReviewAsset: boolean
) => isBusyUploadPhase(uploadPhase) || isLoadingReviewAsset || isSavingReviewAsset;

const preventDismissWhenLocked = (isInteractionLocked: boolean, event: { preventDefault: () => void }) => {
  if (isInteractionLocked) {
    event.preventDefault();
  }
};

const handleOverlayOpenChange = (isInteractionLocked: boolean, onClose: () => void, nextOpen: boolean) => {
  if (!nextOpen && !isInteractionLocked) {
    onClose();
  }
};

export const StudioMediaPickerModeTabs = ({
  disabled = false,
  labels,
  mode,
  onChangeMode,
}: Readonly<{
  disabled?: boolean;
  labels: StudioMediaPickerOverlayLabels['modes'];
  mode: StudioMediaPickerMode;
  onChangeMode: (mode: 'library' | 'upload') => void;
}>) => (
  <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
    <Button
      type="button"
      disabled={disabled}
      variant={mode === 'library' ? 'default' : 'outline'}
      onClick={() => onChangeMode('library')}
    >
      {labels.library}
    </Button>
    <Button
      type="button"
      disabled={disabled}
      variant={mode === 'upload' ? 'default' : 'outline'}
      onClick={() => onChangeMode('upload')}
    >
      {labels.upload}
    </Button>
    {mode === 'review' ? (
      <Button type="button" variant="secondary" disabled>
        {labels.review}
      </Button>
    ) : null}
  </div>
);

export const StudioMediaPickerOverlayDialog = ({
  children,
  isInteractionLocked,
  labels,
  mode,
  onChangeMode,
  onClose,
  open,
}: Readonly<{
  children: React.ReactNode;
  isInteractionLocked: boolean;
  labels: StudioMediaPickerOverlayLabels;
  mode: StudioMediaPickerMode;
  onChangeMode: (mode: 'library' | 'upload') => void;
  onClose: () => void;
  open: boolean;
}>) => (
  <Dialog open={open} onOpenChange={(nextOpen) => handleOverlayOpenChange(isInteractionLocked, onClose, nextOpen)}>
    <DialogContent
      className="max-h-[92vh] w-[min(96vw,1080px)] max-w-none overflow-hidden"
      onEscapeKeyDown={(event) => preventDismissWhenLocked(isInteractionLocked, event)}
      onPointerDownOutside={(event) => preventDismissWhenLocked(isInteractionLocked, event)}
    >
      <DialogHeader>
        <DialogTitle>{labels.title}</DialogTitle>
        <DialogDescription>{labels.description}</DialogDescription>
      </DialogHeader>

      <StudioMediaPickerModeTabs
        disabled={isInteractionLocked}
        labels={labels.modes}
        mode={mode}
        onChangeMode={onChangeMode}
      />
      {children}
    </DialogContent>
  </Dialog>
);
