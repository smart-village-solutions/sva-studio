import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioDestructiveActionDialog } from '@sva/studio-ui-react';

export type FaqTranslator = ReturnType<typeof usePluginTranslation>;

export const FaqEditorActions = ({
  canDelete,
  disabled,
  mode,
  onDelete,
  pt,
}: Readonly<{
  canDelete: boolean;
  disabled: boolean;
  mode: 'create' | 'edit';
  onDelete: () => void;
  pt: FaqTranslator;
}>) => (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="secondary">
      <Link to="/admin/content">{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' && canDelete ? (
      <Button type="button" variant="destructive" disabled={disabled} onClick={onDelete}>
        {pt('actions.delete')}
      </Button>
    ) : null}
  </div>
);

export const FaqDeleteDialog = ({
  errorMessage,
  onCancel,
  onConfirm,
  open,
  pending,
  pt,
  target,
}: Readonly<{
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending: boolean;
  pt: FaqTranslator;
  target: string;
}>) => (
  <StudioDestructiveActionDialog
    open={open}
    title={pt('deleteDialog.title')}
    description={pt('deleteDialog.description', { target })}
    confirmLabel={pt('deleteDialog.confirm')}
    pendingLabel={pt('deleteDialog.pending')}
    cancelLabel={pt('deleteDialog.cancel')}
    pending={pending}
    errorMessage={errorMessage}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);
