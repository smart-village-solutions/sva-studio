import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { loadMainserverDeletionImpact, usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  StudioDestructiveActionDialog,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { deleteNews } from './news.api.js';
import { resolveNewsErrorMessage, type PluginTranslator } from './news.detail-page.helpers.js';

export const useNewsDetailDelete = ({
  contentId,
  actingPrincipalType,
  pt,
}: Readonly<{
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  pt: PluginTranslator;
}>) => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteNavigationFailed, setDeleteNavigationFailed] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const onDelete = async (detachLinkedContent = false) => {
    if (!contentId || deletePending) {
      return;
    }

    setDeleteErrorMessage(null);
    setDeletePending(true);

    try {
      await (detachLinkedContent
        ? deleteNews(contentId, actingPrincipalType, true)
        : deleteNews(contentId, actingPrincipalType));
    } catch (error) {
      setDeleteErrorMessage(resolveNewsErrorMessage(pt, error, 'messages.deleteError'));
      setDeletePending(false);
      return;
    }

    setDeleteDialogOpen(false);
    try {
      await navigate({
        to: '/admin/content',
        state: (previous) => addStudioDestructiveNavigationFeedback(previous, 'news', contentId),
      });
    } catch {
      setDeleteNavigationFailed(true);
    } finally {
      setDeletePending(false);
    }
  };

  return {
    onDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteNavigationFailed,
    deleteErrorMessage,
    setDeleteErrorMessage,
  };
};

export const NewsDetailDeleteDialog = ({
  contentId,
  actingPrincipalType,
  pt,
  title,
  deleteLabel,
  deleteDialogOpen,
  deletePending,
  deleteErrorMessage,
  onDelete,
  setDeleteErrorMessage,
  setDeleteDialogOpen,
}: Readonly<{
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  pt: PluginTranslator;
  title: string;
  deleteLabel: string;
  deleteDialogOpen: boolean;
  deletePending: boolean;
  deleteErrorMessage: string | null;
  onDelete: (detachLinkedContent?: boolean) => Promise<void>;
  setDeleteErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>) => {
  const ct = usePluginTranslation('content');
  return (
    <StudioDestructiveActionDialog
      open={deleteDialogOpen}
      linkedContent={
        contentId
          ? {
              basePath: '/api/v1/mainserver/news',
              contentId,
              actingPrincipalType,
              load: loadMainserverDeletionImpact,
              translate: ct,
            }
          : undefined
      }
      title={pt('actions.deleteConfirmTitle')}
      description={pt('actions.deleteConfirm', { title })}
      confirmLabel={deleteLabel}
      pendingLabel={pt('actions.deleting')}
      cancelLabel={pt('actions.back')}
      pending={deletePending}
      errorMessage={deleteErrorMessage}
      onConfirm={(detachLinkedContent) => void onDelete(detachLinkedContent)}
      onCancel={() => {
        setDeleteErrorMessage(null);
        setDeleteDialogOpen(false);
      }}
    />
  );
};
