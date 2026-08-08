import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioConfirmDialog, StudioFormSummary } from '@sva/studio-ui-react';

export type FaqTranslator = ReturnType<typeof usePluginTranslation>;

export const FaqEditorActions = ({
  disabled,
  mode,
  onDelete,
  pt,
}: Readonly<{
  disabled: boolean;
  mode: 'create' | 'edit';
  onDelete: () => void;
  pt: FaqTranslator;
}>) => (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="outline">
      <Link to="/admin/content">{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' ? (
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
}: Readonly<{
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending: boolean;
  pt: FaqTranslator;
}>) => (
  <StudioConfirmDialog
    open={open}
    title={pt('deleteDialog.title')}
    description={pt('deleteDialog.description')}
    confirmLabel={pt('deleteDialog.confirm')}
    cancelLabel={pt('deleteDialog.cancel')}
    confirmDisabled={pending}
    cancelDisabled={pending}
    onConfirm={onConfirm}
    onCancel={onCancel}
  >
    {errorMessage ? <StudioFormSummary kind="error">{errorMessage}</StudioFormSummary> : null}
  </StudioConfirmDialog>
);
