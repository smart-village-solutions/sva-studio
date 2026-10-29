import * as React from 'react';
import { useForm } from 'react-hook-form';
import { translatePluginKey, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  StudioLoadingState,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
  useStudioEditorLeaveGuard,
  isMainserverPrincipalReady,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createDefaultNewsDetailFormValues, newsDetailFormResolver } from './news.detail-form.js';
import {
  resolvePluginActionLabel,
  type PluginTranslator,
  type StatusMessage,
} from './news.detail-page.helpers.js';
import { useNewsDetailMedia } from './news.detail-page-media.js';
import { useNewsDetailOptions } from './news.detail-page-options.js';
import { useNewsDetailLoad } from './news.detail-page-load.js';
import { useNewsDetailSave } from './news.detail-page-save.js';
import { useNewsDetailDelete } from './news.detail-page-delete.js';
import { createNewsDetailPanels } from './news.detail-page-panels.js';
import { useNewsDirtyTabs, useNewsDetailTabsState } from './news.detail-page-tabs.js';
import { NewsDetailPageView } from './news.detail-page-view.js';
import { useNewsDetailAccess } from './news.detail-page-access.js';
import { pluginNewsActionIds } from './plugin.js';
import type { NewsPrincipalControl, NewsContentItem, NewsDetailFormValues } from './news.types.js';

export const NewsDetailPage = ({
  mode,
  contentId,
  principalControl,
  initiallySaved = false,
  onInitialSavedConsumed,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: NewsPrincipalControl;
  initiallySaved?: boolean;
  onInitialSavedConsumed?: () => void;
}>) => {
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('news', key, variables),
    []
  );
  const deleteLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.delete);
  const saveFeedback = useStudioSaveFeedback();
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  const initialSaveFeedbackShownRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<NewsContentItem | null>(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const [scheduledPublicationInput, setScheduledPublicationInput] = React.useState('');
  const [invalidScheduledPublicationInput, setInvalidScheduledPublicationInput] =
    React.useState(false);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const mediaReferenceSync = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
  const [retryCreatedContentId, setRetryCreatedContentId] = React.useState<string | null>(null);
  const methods = useForm<NewsDetailFormValues>({
    defaultValues: createDefaultNewsDetailFormValues(),
    resolver: newsDetailFormResolver,
  });
  const publicationMode = methods.watch('publicationMode');
  const {
    hasWasteTargetingAccess,
    accessCapabilities,
    canSave,
    canSendPushNotification,
    canSelectMedia,
    canUploadMedia,
    canUpdateMedia,
  } = useNewsDetailAccess(mode, loadedItem, resourceAccess, publicationMode);
  const {
    categoryOptions,
    categoryOptionsLoading,
    categoryOptionsError,
    wasteOverview,
    wasteTargetingAvailability,
    loadWasteTargetingOverview,
  } = useNewsDetailOptions(pt, hasWasteTargetingAccess);
  const formId = React.useId();
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );

  const { formState, reset } = methods;
  const [editorMediaDirty, setEditorMediaDirty] = React.useState(false);
  const leaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges:
      formState.isDirty ||
      (editorMediaDirty && (retryCreatedContentId !== null || mediaUsages.length > 0)) ||
      mediaReferenceSync.hasPendingRetry,
  });
  const submittedRevision = React.useRef<number | null>(null);
  React.useEffect(() => {
    const subscription = methods.watch((_values, { name }) => {
      if (name) leaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [methods, leaveGuard.markChanged]);
  const setEditorMediaUsages = React.useCallback<
    React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>
  >(
    (update) => {
      leaveGuard.markChanged();
      setEditorMediaDirty(true);
      setMediaUsages(update);
    },
    [leaveGuard.markChanged]
  );
  const captureCreateSave = React.useCallback(() => {
    submittedRevision.current = leaveGuard.captureRevision();
  }, [leaveGuard.captureRevision]);
  const completeCreateSave = React.useCallback(() => {
    if (mode !== 'create') return true;
    if (
      submittedRevision.current === null ||
      !leaveGuard.acknowledgeSaved(submittedRevision.current)
    )
      return false;
    reset(methods.getValues());
    setEditorMediaDirty(false);
    return true;
  }, [mode, leaveGuard.acknowledgeSaved, reset, methods]);

  React.useEffect(() => {
    if (formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [formState.isDirty, saveFeedback.markDirty]);

  React.useEffect(() => {
    if (!isLoading && initiallySaved && !initialSaveFeedbackShownRef.current) {
      initialSaveFeedbackShownRef.current = true;
      saveFeedback.showSaved();
      onInitialSavedConsumed?.();
    }
  }, [initiallySaved, isLoading, onInitialSavedConsumed, saveFeedback]);

  const {
    mediaPicker,
    mediaPickerLabels,
    isAssetSelectable,
    addManualMedia,
    mediaPickerFeedback,
    refreshMediaAssets,
    libraryStatus,
  } = useNewsDetailMedia({
    methods,
    mediaUsages,
    setMediaUsages: setEditorMediaUsages,
    setRequiresReferenceSync,
    setMediaAssets,
    pt,
  });
  const dirtyTabs = useNewsDirtyTabs(formState);

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  const { reloadCurrentContext } = useNewsDetailLoad({
    mode,
    contentId,
    principalControl,
    pt,
    reset,
    setIsLoading,
    setStatusMessage,
    setMediaUsages,
    setRequiresReferenceSync,
    setScheduledPublicationInput,
    setInvalidScheduledPublicationInput,
    setLoadedItem,
    setResourceAccess,
    loadedItem,
    actingPrincipalType,
    setActingPrincipalType,
  });
  const { navigateToCreatedDetail, saveCurrentItem } = useNewsDetailSave({
    methods,
    canSave,
    mediaReferenceSync,
    mode,
    contentId,
    saveFeedback,
    pt,
    mediaUsages,
    requiresReferenceSync,
    loadedItem,
    actingPrincipalType,
    hasWasteTargetingAccess,
    wasteTargetingAvailability,
    setStatusMessage,
    setMediaSavePhaseKey,
    setRetryCreatedContentId,
    setLoadedItem,
    setScheduledPublicationInput,
    setInvalidScheduledPublicationInput,
    captureCreateSave,
    completeCreateSave,
    retryCreatedContentId,
  });

  const {
    onDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteNavigationFailed,
    deleteErrorMessage,
    setDeleteErrorMessage,
  } = useNewsDetailDelete({ contentId, actingPrincipalType, pt });

  const { activeTab, handleTabChange, warmTab, visitedTabs } = useNewsDetailTabsState();

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  const tabs = createNewsDetailPanels({
    pt,
    dirtyTabs,
    categoryOptions,
    principalControl,
    actingPrincipalType,
    setActingPrincipalType,
    categoryOptionsError,
    categoryOptionsLoading,
    mode,
    loadedItem,
    mediaUsages,
    addManualMedia,
    setMediaUsages: setEditorMediaUsages,
    setRequiresReferenceSync,
    canSelectMedia,
    canUploadMedia,
    saveFeedback,
    mediaPicker,
    canSendPushNotification,
    wasteOverview,
    wasteTargetingAvailability,
    loadWasteTargetingOverview,
    scheduledPublicationInput,
    invalidScheduledPublicationInput,
    methods,
    setScheduledPublicationInput,
    setInvalidScheduledPublicationInput,
    contentId,
  });

  return (
    <NewsDetailPageView
      {...{
        mode,
        pt,
        canSave: canSave && !(mode === 'create' && retryCreatedContentId),
        principalReady: isMainserverPrincipalReady(principalControl, actingPrincipalType),
        reloadCurrentContext,
        formId,
        mediaReferenceSync,
        saveFeedback,
        mediaSavePhaseKey,
        accessCapabilities,
        setDeleteErrorMessage,
        setDeleteDialogOpen,
        deletePending,
        deleteLabel,
        methods,
        mediaAssets,
        libraryStatus,
        canUploadMedia,
        mediaPickerFeedback,
        isAssetSelectable,
        mediaPicker,
        mediaPickerLabels,
        addManualMedia,
        canUpdateMedia,
        saveCurrentItem,
        deleteNavigationFailed,
        statusMessage,
        retryCreatedContentId,
        navigateToCreatedDetail,
        completeCreateSave,
        setStatusMessage,
        tabs,
        activeTab,
        handleTabChange,
        warmTab,
        visitedTabs,
        deleteDialogOpen,
        deleteErrorMessage,
        onDelete,
      }}
    />
  );
};
