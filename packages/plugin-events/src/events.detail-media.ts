import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  contentMediaUsagesToMainserver,
  createManualContentMediaUsage,
  useStudioEditorLeaveGuard,
  useStudioMediaReferenceSync,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import type { EventsDetailFormValues } from './events.detail-form.js';
import { useEventsMediaPicker } from './events.detail-media-picker.js';

function useEventsCreateMediaGuard(
  methods: UseFormReturn<EventsDetailFormValues>,
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
            contentMediaUsagesToMainserver(
              update.filter((usage) => !usage.localDraft)
            ) as EventsDetailFormValues['content']['mediaContents'],
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

export const useEventsDetailMedia = (
  methods: UseFormReturn<EventsDetailFormValues>,
  pt: ReturnType<typeof usePluginTranslation>,
  mode: 'create' | 'edit'
) => {
  const [mediaUsages, setMediaUsagesState] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [mediaReferencesReady, setMediaReferencesReady] = React.useState(mode === 'create');
  const mediaReferenceSync = useStudioMediaReferenceSync({
    mediaUsages,
    setMediaUsages: setMediaUsagesState,
  });
  const { mediaDirty, setMediaUsages, leaveGuard } = useEventsCreateMediaGuard(
    methods,
    mode,
    mediaUsages,
    setMediaUsagesState,
    mediaReferenceSync.hasPendingRetry
  );
  const picker = useEventsMediaPicker(
    methods,
    pt,
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync
  );
  const addManualMedia = React.useCallback(() => {
    const usage = {
      ...createManualContentMediaUsage({ sortOrder: mediaUsages.length }),
      additionalData: { contentType: 'image', width: '', height: '' },
    };
    const nextUsages = [...mediaUsages, usage];
    methods.setValue(
      'content.mediaContents',
      contentMediaUsagesToMainserver(
        nextUsages
      ) as EventsDetailFormValues['content']['mediaContents'],
      { shouldDirty: true }
    );
    setMediaUsages(nextUsages);
    setRequiresReferenceSync(
      (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
    );
    return usage.uiId;
  }, [mediaUsages, methods]);
  return {
    leaveGuard,
    mediaDirty,
    mediaUsages,
    setMediaUsages,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaReferencesReady,
    setMediaReferencesReady,
    mediaReferenceSync,
    addManualMedia,
    ...picker,
  };
};
