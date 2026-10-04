import { loadMainserverDeletionImpact, usePluginTranslation } from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  StudioDestructiveActionDialog,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import { deleteProject } from './projects.api.js';

export function useProjectEditorDelete({
  contentId,
  actingPrincipalType,
  navigate,
  pt,
}: Readonly<{
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  navigate: ReturnType<typeof useNavigate>;
  pt: ReturnType<typeof usePluginTranslation>;
}>) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();
  const removeProject = async (detachLinkedContent = false) => {
    if (!contentId || deletePending) return;
    setDeleteError(undefined);
    setDeletePending(true);
    try {
      await (detachLinkedContent
        ? deleteProject(contentId, actingPrincipalType, true)
        : deleteProject(contentId, actingPrincipalType));
    } catch {
      setDeleteError(pt('messages.deleteError'));
      setDeletePending(false);
      return;
    }
    setDeleteDialogOpen(false);
    try {
      await navigate({
        to: '/admin/content',
        state: (previous) =>
          addStudioDestructiveNavigationFeedback(previous, 'projects', contentId),
      });
    } catch {
      return;
    } finally {
      setDeletePending(false);
    }
  };
  return {
    contentId,
    actingPrincipalType,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteError,
    setDeleteError,
    removeProject,
  };
}

export function ProjectDeleteDialog({
  pt,
  title,
  deleteDialogOpen,
  deletePending,
  deleteError,
  removeProject,
  setDeleteError,
  setDeleteDialogOpen,
  contentId,
  actingPrincipalType,
}: Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  title: string;
  deleteDialogOpen: boolean;
  deletePending: boolean;
  deleteError?: string;
  removeProject: (detachLinkedContent?: boolean) => Promise<void>;
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  setDeleteError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  const ct = usePluginTranslation('content');
  return (
    <StudioDestructiveActionDialog
      open={deleteDialogOpen}
      linkedContent={
        contentId
          ? {
              basePath: '/api/v1/mainserver/projects',
              contentId,
              actingPrincipalType,
              load: loadMainserverDeletionImpact,
              translate: ct,
            }
          : undefined
      }
      title={pt('messages.deleteTitle')}
      description={pt('messages.deleteDescription', { title })}
      confirmLabel={pt('actions.delete')}
      pendingLabel={pt('messages.deleting')}
      cancelLabel={pt('actions.back')}
      pending={deletePending}
      errorMessage={deleteError}
      onConfirm={(detachLinkedContent) => void removeProject(detachLinkedContent)}
      onCancel={() => {
        setDeleteError(undefined);
        setDeleteDialogOpen(false);
      }}
    />
  );
}
