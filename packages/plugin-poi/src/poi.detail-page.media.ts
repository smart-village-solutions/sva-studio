import { poiMediaUsagesToContents } from './poi.content-media-adapter.js';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  listHostMediaAssets,
  readHostMediaAssetFileName as readAssetFileName,
  readHostMediaAssetTitle as readAssetTitle,
  type HostMediaAssetListItem,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  useStudioEditorLeaveGuard,
  useStudioMediaReferenceSync,
  type ContentMediaUsage,
  type StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { usePoiMediaPicker } from './poi.detail-page.media-picker.js';

export const toPoiMediaPickerSummary = (
  asset: HostMediaAssetListItem
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

type MediaInput = Readonly<{
  instanceId?: string;
  mode: 'create' | 'edit';
  methods: UseFormReturn<PoiDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

function usePoiCreateMediaGuard(
  methods: UseFormReturn<PoiDetailFormValues>,
  mode: 'create' | 'edit',
  mediaUsages: readonly ContentMediaUsage[],
  setMediaUsagesState: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>,
  hasPendingRetry: boolean
) {
  const [mediaDirty, setMediaDirty] = React.useState(false);
  const partialSaveRevision = React.useRef<number | null>(null);
  const createdContentIdRef = React.useRef<string | null>(null);
  const [createdContentId, setCreatedContentId] = React.useState<string | null>(null);
  const rootLeaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges:
      methods.formState.isDirty ||
      (mediaDirty && (createdContentId !== null || mediaUsages.length > 0)) ||
      hasPendingRetry,
  });
  React.useEffect(() => {
    if (mode !== 'create') return;
    const subscription = methods.watch((_values, { name }) => {
      if (name) rootLeaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [methods, mode, rootLeaveGuard]);
  const setMediaUsages = React.useCallback<
    React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>
  >(
    (update) => {
      if (mode === 'create') {
        rootLeaveGuard.markChanged();
        setMediaDirty(true);
        if (typeof update !== 'function') {
          methods.setValue(
            'content.mediaContents',
            poiMediaUsagesToContents(update.filter((usage) => !usage.localDraft)),
            { shouldDirty: true }
          );
        }
      }
      setMediaUsagesState(update);
    },
    [methods, mode, rootLeaveGuard]
  );
  const leaveGuard = React.useMemo(() => {
    const acknowledgeSaved = (revision: number) => {
      if (mode !== 'create' || !rootLeaveGuard.acknowledgeSaved(revision)) return false;
      methods.reset(methods.getValues());
      setMediaDirty(false);
      return true;
    };
    return {
      createdContentId,
      hasCreated: () => createdContentIdRef.current !== null,
      rememberCreated: (id: string) => {
        createdContentIdRef.current = id;
        setCreatedContentId(id);
      },
      captureRevision: rootLeaveGuard.captureRevision,
      acknowledgeSaved,
      rememberPartialSave: (revision: number) => {
        partialSaveRevision.current = revision;
      },
      acknowledgeReferenceRetry: () => {
        if (partialSaveRevision.current !== null) acknowledgeSaved(partialSaveRevision.current);
        partialSaveRevision.current = null;
      },
    };
  }, [methods, mode, rootLeaveGuard, createdContentId]);
  return { mediaDirty, setMediaUsages, leaveGuard };
}

export const usePoiDetailMedia = ({ instanceId, mode, methods, pt }: MediaInput) => {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaUsages, setMediaUsagesState] = React.useState<readonly ContentMediaUsage[]>([]);
  const mediaReferenceSync = useStudioMediaReferenceSync({
    mediaUsages,
    setMediaUsages: setMediaUsagesState,
  });
  const { mediaDirty, setMediaUsages, leaveGuard } = usePoiCreateMediaGuard(
    methods,
    mode,
    mediaUsages,
    setMediaUsagesState,
    mediaReferenceSync.hasPendingRetry
  );
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [mediaReferencesReady, setMediaReferencesReady] = React.useState(mode === 'create');
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const [libraryLoading, setLibraryLoading] = React.useState(false);
  const [libraryError, setLibraryError] = React.useState(false);
  const refreshMediaAssets = React.useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(false);
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      setLibraryError(true);
      return mediaAssetsRef.current;
    } finally {
      setLibraryLoading(false);
    }
  }, [instanceId]);
  const libraryStatus = {
    loading: libraryLoading,
    error: libraryError,
    onRetry: refreshMediaAssets,
  };
  const picker = usePoiMediaPicker({
    instanceId,
    methods,
    pt,
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync,
    mediaAssetsRef,
    refreshMediaAssets,
  });
  return {
    leaveGuard,
    mediaDirty,
    libraryStatus,
    mediaAssets,
    mediaUsages,
    setMediaUsages,
    mediaReferenceSync,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaReferencesReady,
    setMediaReferencesReady,
    refreshMediaAssets,
    ...picker,
  };
};
