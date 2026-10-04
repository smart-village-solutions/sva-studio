import { usePluginTranslation } from '@sva/plugin-sdk';
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
  const removeProject = async () => {
    if (!contentId || deletePending) return;
    setDeleteError(undefined);
    setDeletePending(true);
    try {
      await deleteProject(contentId, actingPrincipalType);
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
}: Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  title: string;
  deleteDialogOpen: boolean;
  deletePending: boolean;
  deleteError?: string;
  removeProject: () => Promise<void>;
  setDeleteError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  return (
    <StudioDestructiveActionDialog
      open={deleteDialogOpen}
      title={pt('messages.deleteTitle')}
      description={pt('messages.deleteDescription', { title })}
      confirmLabel={pt('actions.delete')}
      pendingLabel={pt('messages.deleting')}
      cancelLabel={pt('actions.back')}
      pending={deletePending}
      errorMessage={deleteError}
      onConfirm={() => void removeProject()}
      onCancel={() => {
        setDeleteError(undefined);
        setDeleteDialogOpen(false);
      }}
    />
  );
}
