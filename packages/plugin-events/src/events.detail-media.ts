import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  contentMediaUsagesToMainserver,
  createManualContentMediaUsage,
  useStudioMediaReferenceSync,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import type { EventsDetailFormValues } from './events.detail-form.js';
import { useEventsMediaPicker } from './events.detail-media-picker.js';

export const useEventsDetailMedia = (
  methods: UseFormReturn<EventsDetailFormValues>,
  pt: ReturnType<typeof usePluginTranslation>,
  mode: 'create' | 'edit'
) => {
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [mediaReferencesReady, setMediaReferencesReady] = React.useState(mode === 'create');
  const mediaReferenceSync = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
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
