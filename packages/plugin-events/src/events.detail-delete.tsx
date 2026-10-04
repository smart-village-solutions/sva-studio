import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { loadMainserverDeletionImpact, usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  StudioDestructiveActionDialog,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { deleteEvent } from './events.api.js';
import { eventsErrorMessage } from './events.detail-save.js';

export const useEventsDetailDelete = ({
  contentId,
  actingPrincipalType,
  navigate,
  pt,
}: Readonly<{
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  navigate: ReturnType<typeof useNavigate>;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [navigationFailed, setNavigationFailed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remove = async (detachLinkedContent = false) => {
    if (!contentId || pending) return;
    setPending(true);
    setError(null);
    try {
      await (detachLinkedContent
        ? deleteEvent(contentId, actingPrincipalType, true)
        : deleteEvent(contentId, actingPrincipalType));
    } catch (deleteError) {
      setError(eventsErrorMessage(pt, deleteError, 'messages.deleteError'));
      setPending(false);
      return;
    }

    setDialogOpen(false);
    try {
      await navigate({
        to: '/admin/content',
        state: (previous) => addStudioDestructiveNavigationFeedback(previous, 'events', contentId),
      });
    } catch {
      setNavigationFailed(true);
    } finally {
      setPending(false);
    }
  };

  return {
    dialogOpen,
    setDialogOpen,
    pending,
    navigationFailed,
    error,
    setError,
    remove,
    contentId,
    actingPrincipalType,
  };
};

export function EventsDetailDeleteDialog({
  deletion,
  title,
  pt,
}: Readonly<{
  deletion: ReturnType<typeof useEventsDetailDelete>;
  title: string;
  pt: ReturnType<typeof usePluginTranslation>;
}>) {
  const ct = usePluginTranslation('content');
  return (
    <StudioDestructiveActionDialog
      open={deletion.dialogOpen}
      linkedContent={
        deletion.contentId
          ? {
              basePath: '/api/v1/mainserver/events',
              contentId: deletion.contentId,
              actingPrincipalType: deletion.actingPrincipalType,
              load: loadMainserverDeletionImpact,
              translate: ct,
            }
          : undefined
      }
      title={pt('actions.deleteConfirmTitle')}
      description={pt('actions.deleteConfirm', { title })}
      confirmLabel={pt('actions.delete')}
      pendingLabel={pt('actions.deleting')}
      cancelLabel={pt('actions.cancel')}
      pending={deletion.pending}
      errorMessage={deletion.error}
      onCancel={() => {
        deletion.setError(null);
        deletion.setDialogOpen(false);
      }}
      onConfirm={(detachLinkedContent) => void deletion.remove(detachLinkedContent)}
    />
  );
}
