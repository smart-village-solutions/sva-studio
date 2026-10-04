import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  addStudioDestructiveNavigationFeedback,
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
