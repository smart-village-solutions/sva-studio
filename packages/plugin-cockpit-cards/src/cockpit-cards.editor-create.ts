import * as React from 'react';
import { useStudioEditorLeaveGuard, useStudioMediaReferenceSync } from '@sva/studio-ui-react';
import { useCockpitCardMedia } from './cockpit-cards.editor-media.js';
import type { useCockpitCardForm } from './cockpit-cards.editor-state.js';

export function useCockpitCardCreateMedia(
  mode: 'create' | 'edit',
  form: ReturnType<typeof useCockpitCardForm>['form']
) {
  const [mediaDirty, setMediaDirty] = React.useState(false);
  const [createdContentId, setCreatedContentId] = React.useState<string | null>(null);
  const savedRevision = React.useRef(0);
  const createdContentIdRef = React.useRef<string | null>(null);
  const markMediaChanged = () => {
    setMediaDirty(true);
    leaveGuard.markChanged();
  };
  const media = useCockpitCardMedia(form, markMediaChanged);
  const mediaReferenceSync = useStudioMediaReferenceSync({
    mediaUsages: media.mediaUsages,
    setMediaUsages: media.setMediaUsages,
  });
  const leaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges:
      form.formState.isDirty ||
      (mediaDirty && (createdContentId !== null || media.mediaUsages.length > 0)) ||
      mediaReferenceSync.hasPendingRetry,
  });
  React.useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (name) leaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [form, leaveGuard]);
  const onCreateStarted = () => {
    if (createdContentIdRef.current) return false;
    savedRevision.current = leaveGuard.captureRevision();
    return true;
  };
  const onCreateConfirmed = (id: string) => {
    createdContentIdRef.current = id;
    setCreatedContentId(id);
  };
  const onCreateSaved = () => {
    if (mode !== 'create') return;

    if (leaveGuard.acknowledgeSaved(savedRevision.current)) {
      form.reset(form.getValues());
      setMediaDirty(false);
      media.setRequiresReferenceSync(false);
    }
  };
  return {
    media,
    mediaReferenceSync,
    createdContentId,
    onCreateStarted,
    onCreateConfirmed,
    onCreateSaved,
  };
}
