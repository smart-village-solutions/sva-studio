import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import {
  hasContentLifecycleAccess,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  resolveContentVisibilityAction,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  createStudioMediaPickerLabels,
  StudioLoadingState,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { createDefaultGenericItemsDetailFormValues } from './generic-items.detail-form.js';
import { createGenericItemsDetailLabels } from './generic-items.detail-page.labels.js';
import {
  useGenericItemsCategoryOptions,
  useGenericItemsDetailActions,
  useGenericItemsDetailLoader,
  useGenericItemsMediaAssets,
  type StatusMessage,
} from './generic-items.detail-page.logic.js';
import type { GenericItemsDetailPageViewModel } from './generic-items.detail-page.view-content.js';
import { GenericItemsDetailPageView } from './generic-items.detail-page.view.js';
import { useGenericItemsPageMedia } from './generic-items.detail-page.media-picker.js';
import { useGenericItemsPageSave } from './generic-items.detail-page.save.js';
import {
  useGenericItemsLoadedMedia,
  useGenericItemsCreatedFeedback,
} from './generic-items.detail-page.load.js';
import {
  genericItemsDetailFormSchema,
  type GenericItemsDetailFormValues,
} from './generic-items.validation.js';
import {
  createSummaryErrors,
  loadGenericItemsAssetSnapshot,
} from './generic-items.detail-page.media-model.js';

export { resolveGenericItemsPersistentDeliveryUrl } from './generic-items.detail-page.media-model.js';

export function GenericItemsDetailPage({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const location = useLocation();
  const labels = React.useMemo(() => createGenericItemsDetailLabels(pt), [pt]);
  const mediaPickerLabels = React.useMemo(() => createStudioMediaPickerLabels(pt), [pt]);
  const methods = useForm<GenericItemsDetailFormValues>({
    resolver: zodResolver(genericItemsDetailFormSchema),
    defaultValues: createDefaultGenericItemsDetailFormValues(),
  });
  const saveFeedback = useStudioSaveFeedback();
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  const summaryErrors = React.useMemo(
    () => createSummaryErrors(methods.formState.errors),
    [methods.formState.errors]
  );
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<
    import('./generic-items.api-types.js').GenericItemContentItem | null
  >(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const mediaReferenceSync = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('generic-items', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const nextVisible = methods.watch('visible');
  const canSave =
    mode === 'create'
      ? accessCapabilities.canCreate
      : accessCapabilities.canUpdate &&
        loadedItem !== null &&
        hasContentLifecycleAccess(
          resolveContentVisibilityAction(loadedItem.visible === true, nextVisible),
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
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;
  const { mediaAssets, refreshMediaAssets } = useGenericItemsMediaAssets();
  const { categoryOptions, categoryOptionsError, categoryOptionsLoading } =
    useGenericItemsCategoryOptions(pt);
  const handleLoadedItem = useGenericItemsLoadedMedia({
    contentId,
    setLoadedItem,
    setMediaUsages,
    setRequiresReferenceSync,
    setStatus,
    pt,
  });
  const loading = useGenericItemsDetailLoader({
    contentId,
    methods,
    mode,
    pt,
    setStatus,
    onLoaded: handleLoadedItem,
    onAccessLoaded: setResourceAccess,
    actingPrincipalType,
  });
  useGenericItemsCreatedFeedback({
    loading,
    locationState: location.state,
    contentId,
    navigate,
    saveFeedback,
  });
  const { activeTab, deleting, deleteNavigationFailed, handleDelete, setActiveTab } =
    useGenericItemsDetailActions({
      contentId,
      mode,
      navigate,
      onDeleted: () => setDeleteDialogOpen(false),
      pt,
      setStatus,
      actingPrincipalType,
    });
  const { isAssetSelectable, mediaPicker, addManualMedia, mediaPickerFeedback } =
    useGenericItemsPageMedia({
      methods,
      mediaUsages,
      setMediaUsages,
      setRequiresReferenceSync,
      mediaAssets,
      refreshMediaAssets,
      pt,
    });

  const onSubmit = useGenericItemsPageSave({
    methods,
    canSave,
    mode,
    actingPrincipalType,
    contentId,
    mediaUsages,
    requiresReferenceSync,
    mediaReferenceSync,
    saveFeedback,
    setStatus,
    setMediaSavePhaseKey,
    navigate,
    pt,
  });

  const view: GenericItemsDetailPageViewModel = {
    mode,
    contentId,
    pt,
    methods,
    labels,
    mediaPickerLabels,
    summaryErrors,
    status,
    setStatus,
    actingPrincipalType,
    setActingPrincipalType,
    principalControl,
    deleteDialogOpen,
    setDeleteDialogOpen,
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync,
    mediaReferenceSync,
    accessCapabilities,
    canSelectMedia,
    canUploadMedia,
    canUpdateMedia,
    mediaAssets,
    isAssetSelectable,
    mediaPicker,
    addManualMedia,
    mediaPickerFeedback,
    navigate,
    deleteNavigationFailed,
    deleting,
    handleDelete,
    activeTab,
    setActiveTab,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    saveFeedback,
    getAssetSnapshot: loadGenericItemsAssetSnapshot,
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <GenericItemsDetailPageView
        view={view}
        canSave={canSave}
        mediaSavePhaseKey={mediaSavePhaseKey}
        onSubmit={onSubmit}
      />
    </FormProvider>
  );
}
