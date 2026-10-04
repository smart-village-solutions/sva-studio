import React from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from '@tanstack/react-router';
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
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioLoadingState,
  useStudioSaveFeedback,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import {
  createDefaultEventsDetailFormValues,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { createEventsDetailTabDefinitions, type EventsDetailTabId } from './events.detail-tabs.js';
import { createEventsDetailSubmit, type EventsStatusMessage } from './events.detail-save.js';
import { useEventsDetailMedia } from './events.detail-media.js';
import { EventsDetailPageView } from './events.detail-page-view.js';
import { useEventsDetailLoad } from './events.detail-load.js';
import { useEventsDetailDelete } from './events.detail-delete.js';
import { createEventsDeviationFieldLabels } from './events.detail-save-validation.js';

export function EventsDetailPage({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const location = useLocation();
  const formId = React.useId();
  const methods = useForm<EventsDetailFormValues>({
    defaultValues: createDefaultEventsDetailFormValues(),
  });
  const saveFeedback = useStudioSaveFeedback();
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  const initialSaveFeedbackShownRef = React.useRef(false);
  const [status, setStatus] = React.useState<EventsStatusMessage | null>(null);
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const media = useEventsDetailMedia(methods, pt, mode);
  const {
    mediaUsages,
    setMediaUsages,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaReferencesReady,
    setMediaReferencesReady,
    mediaReferenceSync,
    refreshMediaAssets,
  } = media;
  const {
    loading,
    deviations,
    loadedItem,
    resourceAccess,
    categoryOptions,
    categoryOptionsLoading,
    categoryOptionsError,
  } = useEventsDetailLoad({
    mode,
    contentId,
    principalControl,
    actingPrincipalType,
    methods,
    pt,
    setStatus,
    setMediaUsages,
    setRequiresReferenceSync,
    setMediaReferencesReady,
    refreshMediaAssets,
  });
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  React.useEffect(() => {
    if (
      loading ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'events', contentId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/events/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, location.state, navigate, saveFeedback]);
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('events', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const nextVisible = methods.watch('settings.visible');
  const canSave =
    mode === 'create'
      ? accessCapabilities.canCreate
      : accessCapabilities.canUpdate &&
        loadedItem !== null &&
        hasContentLifecycleAccess(
          resolveContentVisibilityAction(loadedItem.visible ?? true, nextVisible),
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
  const [activeTab, setActiveTab] = React.useState<EventsDetailTabId>('basis');
  const [pendingFocusId, setPendingFocusId] = React.useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = React.useState<readonly EventsDetailTabId[]>(['basis']);
  const deviationFieldLabels = createEventsDeviationFieldLabels(pt);

  const tabs = createEventsDetailTabDefinitions(pt);

  const warmTab = React.useCallback((tabId: EventsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  React.useEffect(() => {
    if (!pendingFocusId) return;
    const element = globalThis.document?.getElementById(pendingFocusId);
    if (!element) return;
    element.focus();
    setPendingFocusId(null);
  }, [activeTab, pendingFocusId]);

  const handleTabChange = React.useCallback(
    (tabId: EventsDetailTabId) => {
      warmTab(tabId);
      setActiveTab(tabId);
    },
    [warmTab]
  );

  const submit = createEventsDetailSubmit({
    methods,
    canSave,
    mediaUsages,
    setStatus,
    pt,
    setActiveTab,
    setPendingFocusId,
    saveFeedback,
    setMediaSavePhaseKey,
    deviations,
    deviationFieldLabels,
    mode,
    actingPrincipalType,
    contentId,
    requiresReferenceSync,
    mediaReferenceSync,
    navigate,
  });

  const deletion = useEventsDetailDelete({ contentId, actingPrincipalType, navigate, pt });

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <EventsDetailPageView
      methods={methods}
      pt={pt}
      mode={mode}
      contentId={contentId}
      formId={formId}
      canSave={canSave}
      saveFeedback={saveFeedback}
      mediaSavePhaseKey={mediaSavePhaseKey}
      accessCapabilities={accessCapabilities}
      deletion={deletion}
      media={media}
      canUploadMedia={canUploadMedia}
      canUpdateMedia={canUpdateMedia}
      canSelectMedia={canSelectMedia}
      navigate={navigate}
      submit={submit}
      status={status}
      actingPrincipalType={actingPrincipalType}
      setActingPrincipalType={setActingPrincipalType}
      principalControl={principalControl}
      deviations={deviations}
      deviationFieldLabels={deviationFieldLabels}
      tabs={tabs}
      activeTab={activeTab}
      handleTabChange={handleTabChange}
      warmTab={warmTab}
      visitedTabs={visitedTabs}
      categoryOptions={categoryOptions}
      categoryOptionsError={categoryOptionsError}
      categoryOptionsLoading={categoryOptionsLoading}
      loadedItem={loadedItem}
      mediaReferencesReady={mediaReferencesReady}
      setStatus={setStatus}
    />
  );
}
