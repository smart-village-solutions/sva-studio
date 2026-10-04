import {
  hasContentLifecycleAccess,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  resolveContentLifecycleAction,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
} from '@sva/plugin-sdk';
import {
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useProjectCreatedFeedback, useProjectEditorLoad } from './projects.editor-load.js';
import type { ProjectContentItem } from './projects.api-types.js';
import type { ProjectTab } from './projects.editor-tabs.js';
import type { ProjectFormValues } from './projects.validation.js';

function useProjectAccess({
  mode,
  item,
  form,
  resourceAccess,
}: Readonly<{
  mode: 'create' | 'edit';
  item?: ProjectContentItem;
  form: UseFormReturn<ProjectFormValues>;
  resourceAccess: Readonly<Record<string, boolean>>;
}>) {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('projects', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const nextStatus = form.watch('status');
  const canSave =
    mode === 'create'
      ? accessCapabilities.canCreate
      : accessCapabilities.canUpdate &&
        item !== undefined &&
        hasContentLifecycleAccess(
          resolveContentLifecycleAction(item.status, nextStatus),
          resourceAccess
        );
  const mediaCapabilities = React.useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent: canSave,
        permissionActions: sessionAccess.permissionActions,
      }),
    [canSave, sessionAccess.permissionActions]
  );
  return {
    accessCapabilities,
    canSave,
    canSelectMedia: mediaCapabilities.canSelect,
    canUploadMedia: mediaCapabilities.canUpload,
    canUpdateMedia: mediaCapabilities.canEditAssetMetadata,
  };
}

export function useProjectEditorState({
  form,
  mode,
  contentId,
  principalControl,
  locationState,
  navigate,
}: Readonly<{
  form: UseFormReturn<ProjectFormValues>;
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
  locationState: unknown;
  navigate: ReturnType<typeof useNavigate>;
}>) {
  const saveFeedback = useStudioSaveFeedback();
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (form.formState.isDirty) saveFeedback.markDirty();
  }, [form.formState.isDirty, saveFeedback.markDirty]);
  const [tab, setTab] = React.useState<ProjectTab>('basis');
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const [mutationError, setMutationError] = React.useState<string>();
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const mediaReferenceSync = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
  const [retryCreatedContentId, setRetryCreatedContentId] = React.useState<string | null>(null);
  const { item, setItem, loading, loadError, resourceAccess } = useProjectEditorLoad({
    mode,
    contentId,
    actingPrincipalType,
    form,
    setMediaUsages,
    setRequiresReferenceSync,
  });
  useProjectCreatedFeedback({ loading, locationState, contentId, navigate, saveFeedback });
  const access = useProjectAccess({ mode, item, form, resourceAccess });
  return {
    saveFeedback,
    mediaSavePhaseKey,
    setMediaSavePhaseKey,
    tab,
    setTab,
    actingPrincipalType,
    setActingPrincipalType,
    mutationError,
    setMutationError,
    mediaUsages,
    setMediaUsages,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaReferenceSync,
    retryCreatedContentId,
    setRetryCreatedContentId,
    item,
    setItem,
    loading,
    loadError,
    ...access,
  };
}
