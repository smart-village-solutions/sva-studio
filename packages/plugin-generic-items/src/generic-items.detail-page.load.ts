import React from 'react';
import type { NavigateFn } from '@tanstack/react-router';
import {
  alignHostMediaReferencesByOrder,
  listHostMediaReferencesByTarget,
  type usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  type ContentMediaUsage,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { GenericItemContentItem } from './generic-items.api-types.js';
import { genericItemMediaContentsToUsages } from './generic-items.content-media-adapter.js';
import { genericItemsMediaReferenceTargetType } from './generic-items.detail-page.media-model.js';
import type { StatusMessage } from './generic-items.detail-page.logic.js';
import type { mapGenericItemToDetailFormValues } from './generic-items.detail-form.js';

export const useGenericItemsLoadedMedia = ({
  contentId,
  setLoadedItem,
  setMediaUsages,
  setRequiresReferenceSync,
  setStatus,
  pt,
}: Readonly<{
  contentId?: string;
  setLoadedItem: React.Dispatch<React.SetStateAction<GenericItemContentItem | null>>;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  pt: ReturnType<typeof usePluginTranslation>;
}>) =>
  React.useCallback(
    (item: Parameters<typeof mapGenericItemToDetailFormValues>[0]) => {
      if (!contentId) return;
      setLoadedItem(item);
      const sourceMedia = item.mediaContents ?? [];
      setMediaUsages(genericItemMediaContentsToUsages(sourceMedia));
      void listHostMediaReferencesByTarget({
        fetch: globalThis.fetch.bind(globalThis),
        targetType: genericItemsMediaReferenceTargetType,
        targetId: contentId,
      })
        .then((references) => {
          setMediaUsages(
            genericItemMediaContentsToUsages(
              sourceMedia,
              alignHostMediaReferencesByOrder({
                itemCount: sourceMedia.length,
                role: 'gallery_item',
                references,
              })
            )
          );
          setRequiresReferenceSync(references.length > 0);
        })
        .catch(() => {
          setStatus({ kind: 'error', text: pt('messages.loadError') });
        });
    },
    [contentId, pt]
  );

export const useGenericItemsCreatedFeedback = ({
  loading,
  locationState,
  contentId,
  navigate,
  saveFeedback,
}: Readonly<{
  loading: boolean;
  locationState: unknown;
  contentId?: string;
  navigate: NavigateFn;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>) => {
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      loading ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(locationState, 'generic-items', contentId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/generic-items/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, locationState, navigate, saveFeedback]);
};
