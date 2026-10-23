import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useStudioEditorLeaveGuard, type ContentMediaUsage } from '@sva/studio-ui-react';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export function useGenericItemsCreateMediaGuard(
  methods: UseFormReturn<GenericItemsDetailFormValues>,
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
      }
      setMediaUsagesState(update);
    },
    [mode, rootLeaveGuard]
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
  return { mediaDirty, createdContentId, setMediaUsages, leaveGuard };
}
