import React from 'react';

import { ModalDialog } from './ModalDialog';

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  return (
    <ModalDialog
      open={open}
      title={title}
      description={description}
      role="alertdialog"
      onClose={onCancel}
    >
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="rounded-md border border-red-700 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
};
