import { Link } from '@tanstack/react-router';
import { loadMainserverDeletionImpact, usePluginTranslation } from '@sva/plugin-sdk';
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
  contentId,
  actingPrincipalType,
}: Readonly<{
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: (detachLinkedContent?: boolean) => void;
  contentId?: string;
  actingPrincipalType: 'organization' | 'user';
  open: boolean;
  pending: boolean;
  pt: FaqTranslator;
  target: string;
}>) => {
  const ct = usePluginTranslation('content');
  return (
    <StudioDestructiveActionDialog
      open={open}
      linkedContent={
        contentId
          ? {
              basePath: '/api/v1/mainserver/faqs',
              contentId,
              actingPrincipalType,
              load: loadMainserverDeletionImpact,
              translate: ct,
            }
          : undefined
      }
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
};
