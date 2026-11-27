import * as React from 'react';
import type { StudioMediaPickerReviewPanelProps } from './studio-media-picker-review-panel.js';
import { createMetadataDraft } from './studio-media-picker-overlay.shared.js';

type CloseGuardProps = Pick<
  StudioMediaPickerReviewPanelProps,
  'reviewAsset' | 'metadataDraft' | 'onClose'
> & {
  open: boolean;
};

export const useMediaCloseGuard = (
  props: CloseGuardProps,
  workspaceDirty: boolean,
  linkDirty: boolean,
  onConfirm: () => void
) => {
  const dirty =
    workspaceDirty ||
    linkDirty ||
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

export const restoreManualMediaFocus = (
  event: Event,
  acceptedUiId: React.RefObject<string | null>
) => {
  const uiId = acceptedUiId.current;
  acceptedUiId.current = null;
  const target = uiId ? globalThis.document?.getElementById(`content-media-${uiId}-url`) : null;
  if (target) {
    event.preventDefault();
    target.focus();
  }
};

export const useManualMediaPicker = (open: boolean) => {
  const [workspaceDirty, setWorkspaceDirty] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualUrl, setManualUrl] = React.useState('');
  const acceptedManualUiId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (open) return;
    setWorkspaceDirty(false);
    setManualOpen(false);
    setManualUrl('');
  }, [open]);
  return {
    workspaceDirty,
    setWorkspaceDirty,
    manualOpen,
    setManualOpen,
    manualUrl,
    setManualUrl,
    acceptedManualUiId,
  };
};
