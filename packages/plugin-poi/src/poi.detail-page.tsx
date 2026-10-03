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
  createStudioMediaPickerLabels,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { createDefaultPoiDetailFormValues, type PoiDetailFormValues } from './poi.detail-form.js';
import { usePoiDetailSave } from './poi.detail-page.save.js';
import { createPoiDeviationFieldLabels } from './poi.detail-page.labels.js';
import { usePoiDetailDelete } from './poi.detail-page.delete.js';
import { usePoiDetailLoad } from './poi.detail-page.load.js';
import { usePoiDetailMedia } from './poi.detail-page.media.js';
import { PoiDetailPageView, type PoiDetailPageViewModel } from './poi.detail-page.view.js';
import { createPoiDetailTabDefinitions, usePoiDetailTabState } from './poi.detail-tabs.js';
import type { PoiCategoryOption, PoiContentItem } from './poi.types.js';

type StatusMessage = Readonly<{ kind: 'success' | 'error'; text: string }>;

export function PoiDetailPage({
  mode,
  contentId,
  instanceId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const location = useLocation();
  const formId = React.useId();
  const methods = useForm<PoiDetailFormValues>({
    defaultValues: createDefaultPoiDetailFormValues(),
  });
  const saveFeedback = useStudioSaveFeedback();
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  const initialSaveFeedbackShownRef = React.useRef(false);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [deviations, setDeviations] = React.useState<readonly { fieldGroup: string }[]>([]);
  const [loadedItem, setLoadedItem] = React.useState<PoiContentItem | null>(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  React.useEffect(() => {
    if (methods.formState.isDirty) {
      saveFeedback.markDirty();
    }
  }, [methods.formState.isDirty, saveFeedback.markDirty]);
  React.useEffect(() => {
    if (
      loading ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'poi', contentId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/poi/$id',
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
    () => resolveStandardContentAccessCapabilities('poi', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const nextVisible = methods.watch('basis.active');
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
  const { activeTab, setActiveTab, visitedTabs, handleTabChange, warmTab } = usePoiDetailTabState();
  const [categoryOptions, setCategoryOptions] = React.useState<readonly PoiCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const mediaPickerLabels = React.useMemo(
    () => createStudioMediaPickerLabels(pt, { titleFieldKey: 'fields.name' }),
    [pt]
  );
  const focusFieldById = React.useCallback((fieldId: string) => {
    globalThis.setTimeout(() => {
      globalThis.document.getElementById(fieldId)?.focus();
    }, 0);
  }, []);

  const media = usePoiDetailMedia({ instanceId, mode, methods, pt });
  const {
    mediaUsages,
    setMediaUsages,
    mediaReferenceSync,
    requiresReferenceSync,
    setRequiresReferenceSync,
    setMediaReferencesReady,
    refreshMediaAssets,
  } = media;
  const deviationFieldLabels = createPoiDeviationFieldLabels(pt);

  usePoiDetailLoad({
    mode,
    contentId,
    instanceId,
    initialPrincipalType: principalControl?.value ?? 'user',
    actingPrincipalType,
    methods,
    pt,
    refreshMediaAssets,
    setMediaUsages,
    setRequiresReferenceSync,
    setMediaReferencesReady,
    setStatus,
    loadedItem,
    setLoadedItem,
    setLoading,
    setDeviations,
    setResourceAccess,
    setCategoryOptions,
    setCategoryOptionsLoading,
    setCategoryOptionsError,
  });

  const tabs = createPoiDetailTabDefinitions(pt);

  const submit = usePoiDetailSave({
    methods,
    canSave,
    mode,
    actingPrincipalType,
    contentId,
    instanceId,
    mediaUsages,
    requiresReferenceSync,
    mediaReferenceSync,
    saveFeedback,
    setStatus,
    setMediaSavePhaseKey,
    setActiveTab,
    focusFieldById,
    deviations,
    deviationFieldLabels,
    navigate,
    pt,
  });

  const {
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteNavigationFailed,
    deleteErrorMessage,
    setDeleteErrorMessage,
    remove,
  } = usePoiDetailDelete({ contentId, actingPrincipalType, navigate, pt });

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  const view: PoiDetailPageViewModel = {
    mode,
    contentId,
    instanceId,
    principalControl,
    pt,
    navigate,
    formId,
    methods,
    saveFeedback,
    mediaSavePhaseKey,
    status,
    setStatus,
    deviations,
    loadedItem,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteNavigationFailed,
    deleteErrorMessage,
    setDeleteErrorMessage,
    actingPrincipalType,
    setActingPrincipalType,
    accessCapabilities,
    canSave,
    canSelectMedia,
    canUploadMedia,
    canUpdateMedia,
    activeTab,
    visitedTabs,
    categoryOptions,
    categoryOptionsLoading,
    categoryOptionsError,
    mediaPickerLabels,
    media,
    deviationFieldLabels,
    tabs,
    handleTabChange,
    warmTab,
    submit,
    remove,
  };
  return <PoiDetailPageView view={view} />;
}
