import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useNavigate } from '@tanstack/react-router';
import {
  contentMediaSavePhaseMessageKey,
  saveContentWithHostMediaReferences,
  toDatetimeLocalValue,
} from '@sva/plugin-sdk';
import {
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  contentMediaUsagesToMainserver,
  resolveContentMediaUsageDrafts,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createNews, saveNewsEditorItem, updateNews } from './news.api.js';
import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { mapNewsItemToDetailFormValues } from './news.detail-form.js';
import {
  resolveNewsErrorMessage,
  type PluginTranslator,
  type StatusMessage,
} from './news.detail-page.helpers.js';
import {
  requiresGlobalPushConfirmation,
  resolveGlobalPushConfirmationKey,
  type WasteTargetingAvailability,
} from './news.waste-payload.js';
import { addNewsCreatedSaveFeedback } from './news.save-feedback.js';
import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';

const persistNewsDetailContent = async ({
  values,
  contentId,
  mediaUsages,
  loadedItem,
  actingPrincipalType,
  hasWasteTargetingAccess,
  requiresReferenceSync,
  setMediaSavePhaseKey,
  mediaReferenceSync,
}: Readonly<{
  values: NewsDetailFormValues;
  contentId?: string;
  mediaUsages: readonly ContentMediaUsage[];
  loadedItem: NewsContentItem | null;
  actingPrincipalType: MainserverPrincipalType;
  hasWasteTargetingAccess: boolean;
  requiresReferenceSync: boolean;
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
}>) => {
  const saveContent = (
    draftResolutions: Parameters<typeof resolveContentMediaUsageDrafts>[1] = [],
    mediaSaveContext?: Readonly<{ operationId: string }>
  ) =>
    saveNewsEditorItem(
      {
        contentId,
        values: {
          ...values,
          contentMedia: contentMediaUsagesToMainserver(
            resolveContentMediaUsageDrafts(mediaUsages, draftResolutions)
          ) as NewsDetailFormValues['contentMedia'],
        },
        existingItem: loadedItem ?? null,
        actingPrincipalType,
        canWriteWasteTargets: hasWasteTargetingAccess,
        mutationOptions: mediaSaveContext
          ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
          : undefined,
      },
      { createNews, updateNews }
    );
  const result = requiresReferenceSync
    ? await saveContentWithHostMediaReferences({
        fetch: globalThis.fetch.bind(globalThis),
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: NEWS_CONTENT_TYPE,
        references: mediaUsages.flatMap((usage) => {
          const reference = contentMediaUsageToReference(usage);
          return reference ? [reference] : [];
        }),
        drafts: contentMediaUsagesToLocalDrafts(mediaUsages),
        onPhaseChange: (phase) => setMediaSavePhaseKey(contentMediaSavePhaseMessageKey(phase)),
      })
    : { status: 'complete' as const, saved: await saveContent(), resolutions: [] };
  return mediaReferenceSync.consumeSaveResult(result);
};

type NewsDetailSaveOptions = Readonly<{
  methods: UseFormReturn<NewsDetailFormValues>;
  canSave: boolean;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  mode: 'create' | 'edit';
  contentId?: string;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  pt: PluginTranslator;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  loadedItem: NewsContentItem | null;
  actingPrincipalType: MainserverPrincipalType;
  hasWasteTargetingAccess: boolean;
  wasteTargetingAvailability: WasteTargetingAvailability;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
  setRetryCreatedContentId: React.Dispatch<React.SetStateAction<string | null>>;
  setLoadedItem: React.Dispatch<React.SetStateAction<NewsContentItem | null>>;
  setScheduledPublicationInput: React.Dispatch<React.SetStateAction<string>>;
  setInvalidScheduledPublicationInput: React.Dispatch<React.SetStateAction<boolean>>;
}>;

const didDeclineGlobalPush = (
  values: NewsDetailFormValues,
  loadedItem: NewsContentItem | null,
  pt: PluginTranslator,
  wasteTargetingAvailability: WasteTargetingAvailability
): boolean =>
  requiresGlobalPushConfirmation({
    pushNotificationEnabled: values.pushNotificationEnabled,
    targetCount: values.wasteLocationKeys.length,
    pushNotificationsSentAt: loadedItem?.pushNotificationsSentAt,
  }) &&
  typeof globalThis.window.confirm === 'function' &&
  globalThis.window.confirm(pt(resolveGlobalPushConfirmationKey(wasteTargetingAvailability))) ===
    false;

export const useNewsDetailSave = ({
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
}: NewsDetailSaveOptions) => {
  const navigate = useNavigate();
  const { reset } = methods;
  const navigateToCreatedDetail = React.useCallback(
    (createdContentId: string) =>
      navigate({
        to: '/admin/news/$id',
        params: { id: createdContentId },
        state: (previous) => addNewsCreatedSaveFeedback(previous, createdContentId),
      }),
    [navigate]
  );

  const saveCurrentItem = methods.handleSubmit(
    async (values) => {
      if (!canSave) return;
      if (didDeclineGlobalPush(values, loadedItem, pt, wasteTargetingAvailability)) return;
      if (mediaReferenceSync.hasPendingRetry) {
        setStatusMessage({
          source: 'reference',
          text: pt('messages.mediaReferencePartialFailure'),
        });
        return;
      }

      if (mode === 'edit' && !contentId) {
        setStatusMessage({ source: 'load', text: pt('messages.missingContent') });
        return;
      }

      const operationId = saveFeedback.beginSaving();
      setMediaSavePhaseKey(null);
      try {
        const handledResult = await persistNewsDetailContent({
          values,
          contentId,
          mediaUsages,
          loadedItem,
          actingPrincipalType,
          hasWasteTargetingAccess,
          requiresReferenceSync,
          setMediaSavePhaseKey,
          mediaReferenceSync,
        });
        const saved = handledResult.saved;
        if (handledResult.referenceFailed) {
          setRetryCreatedContentId(mode === 'create' ? saved.id : null);
          setStatusMessage({
            source: 'reference',
            text: pt('messages.mediaReferencePartialFailure'),
          });
          saveFeedback.markFailed(operationId);
          return;
        }

        if (mode === 'create') {
          saveFeedback.markSaved(operationId);
          try {
            await navigateToCreatedDetail(saved.id);
          } catch {
            setRetryCreatedContentId(saved.id);
            setStatusMessage({
              source: 'navigation',
              text: pt('messages.detailNavigationError'),
            });
            saveFeedback.markFailed(operationId);
          }
          return;
        }

        const nextValues = mapNewsItemToDetailFormValues(saved);
        reset(nextValues);
        setRetryCreatedContentId(null);
        setLoadedItem(saved);
        setScheduledPublicationInput(toDatetimeLocalValue(nextValues.scheduledPublicationAt));
        setInvalidScheduledPublicationInput(false);
        setStatusMessage(null);
        saveFeedback.markSaved(operationId);
      } catch (error) {
        setStatusMessage({
          source: 'save',
          text: resolveNewsErrorMessage(pt, error, 'messages.saveError'),
        });
        saveFeedback.markFailed(operationId);
      }
    },
    () => {
      setStatusMessage(null);
      saveFeedback.reset();
    }
  );

  return { navigateToCreatedDetail, saveCurrentItem };
};
