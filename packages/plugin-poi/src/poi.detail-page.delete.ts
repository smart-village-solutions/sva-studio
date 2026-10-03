import React from 'react';
import { type NavigateFn } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { deletePoi, PoiApiError } from './poi.api.js';

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
  const remove = async () => {
    if (!contentId || deletePending) return;
    setDeleteErrorMessage(null);
    setDeletePending(true);
    try {
      await deletePoi(contentId, actingPrincipalType);
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
