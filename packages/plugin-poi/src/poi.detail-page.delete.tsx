import React from 'react';
import { type NavigateFn } from '@tanstack/react-router';
import { loadMainserverDeletionImpact, usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  StudioDestructiveActionDialog,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { deletePoi, PoiApiError } from './poi.api.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';

type DeleteInput = Readonly<{
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  navigate: NavigateFn;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

export const usePoiDetailDelete = ({
  contentId,
  actingPrincipalType,
  navigate,
  pt,
}: DeleteInput) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteNavigationFailed, setDeleteNavigationFailed] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const remove = async (detachLinkedContent = false) => {
    if (!contentId || deletePending) return;
    setDeleteErrorMessage(null);
    setDeletePending(true);
    try {
      await (detachLinkedContent
        ? deletePoi(contentId, actingPrincipalType, true)
        : deletePoi(contentId, actingPrincipalType));
    } catch (deleteError) {
      setDeleteErrorMessage(
        deleteError instanceof PoiApiError ? deleteError.message : pt('messages.deleteError')
      );
      setDeletePending(false);
      return;
    }
    setDeleteDialogOpen(false);
    try {
      await navigate({
        to: '/admin/content',
        state: (previous) => addStudioDestructiveNavigationFeedback(previous, 'poi', contentId),
      });
    } catch {
      setDeleteNavigationFailed(true);
    } finally {
      setDeletePending(false);
    }
  };
  return {
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteNavigationFailed,
    deleteErrorMessage,
    setDeleteErrorMessage,
    remove,
  };
};

export function PoiDeleteDialog({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const ct = usePluginTranslation('content');
  const {
    deleteDialogOpen,
    pt,
    methods,
    deletePending,
    deleteErrorMessage,
    remove,
    setDeleteErrorMessage,
    setDeleteDialogOpen,
    contentId,
    actingPrincipalType,
  } = view;
  return (
    <StudioDestructiveActionDialog
      open={deleteDialogOpen}
      linkedContent={
        contentId
          ? {
              basePath: '/api/v1/mainserver/poi',
              contentId,
              actingPrincipalType,
              load: loadMainserverDeletionImpact,
              translate: ct,
            }
          : undefined
      }
      title={pt('actions.deleteConfirmTitle')}
      description={pt('actions.deleteConfirm', {
        title: methods.getValues('name') || pt('detail.editTitle'),
      })}
      confirmLabel={pt('actions.delete')}
      pendingLabel={pt('actions.deleting')}
      cancelLabel={pt('actions.back')}
      pending={deletePending}
      errorMessage={deleteErrorMessage}
      onConfirm={(detachLinkedContent) => void remove(detachLinkedContent)}
      onCancel={() => {
        setDeleteErrorMessage(null);
        setDeleteDialogOpen(false);
      }}
    />
  );
}
