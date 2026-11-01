import { ContentMediaSaveError } from '@sva/plugin-sdk/content-media';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useNavigate } from '@tanstack/react-router';
import {
  contentMediaSavePhaseMessageKey,
  readMainserverMutationFailureOutcome,
  readMainserverErrorRequestId,
  saveContentWithHostMediaReferences,
  toDatetimeLocalValue,
} from '@sva/plugin-sdk';
import {
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  contentMediaUsagesToMainserver,
  resolveContentMediaUsageDrafts,
  useStudioMediaReferenceSync,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createNews, saveNewsEditorItem, updateNews } from './news.api.js';
import {
  useNewsSaveRecovery,
  type PendingNewsSave,
  type NewsSaveRefs,
  type NewsSaveRecoveryOptions,
} from './news.detail-page-recovery.js';
import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { mapNewsItemToDetailFormValues } from './news.detail-form.js';
import { didDeclineGlobalPush, newsSaveErrorStatus } from './news.detail-page.helpers.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
import { addNewsCreatedSaveFeedback } from './news.save-feedback.js';
import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';

const persistNewsDetailContent = async ({
  values,
  mutationId,
  onContentSaveStarted,
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
  mutationId: string;
  onContentSaveStarted: () => void;
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
  ) => {
    onContentSaveStarted();
    return saveNewsEditorItem(
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
        mutationOptions: {
          operationId: mutationId,
          idempotencyKey: mutationId,
          ...(mediaSaveContext
            ? { contentMediaSaveOperationId: mediaSaveContext.operationId }
            : {}),
        },
      },
      { createNews, updateNews }
    );
  };
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

type NewsDetailSaveOptions = NewsSaveRecoveryOptions &
  Readonly<{
    methods: UseFormReturn<NewsDetailFormValues>;
    canSave: boolean;
    mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
    contentId?: string;
    mediaUsages: readonly ContentMediaUsage[];
    requiresReferenceSync: boolean;
    loadedItem: NewsContentItem | null;
    actingPrincipalType: MainserverPrincipalType;
    hasWasteTargetingAccess: boolean;
    wasteTargetingAvailability: WasteTargetingAvailability;
    setMediaSavePhaseKey: React.Dispatch<React.SetStateAction<string | null>>;
    setScheduledPublicationInput: React.Dispatch<React.SetStateAction<string>>;
    setInvalidScheduledPublicationInput: React.Dispatch<React.SetStateAction<boolean>>;
    captureCreateSave: () => void;
    completeCreateSave: () => boolean;
    retryCreatedContentId: string | null;
    pendingSave: PendingNewsSave | null;
  }>;

function useCreatedNewsNavigation() {
  const navigate = useNavigate();
  const navigateToCreatedDetail = React.useCallback(
    (createdContentId: string) =>
      navigate({
        to: '/admin/news/$id',
        params: { id: createdContentId },
        state: (previous) => addNewsCreatedSaveFeedback(previous, createdContentId),
      }),
    [navigate]
  );

  return navigateToCreatedDetail;
}

const completeNewsDetailSave = async (
  options: NewsDetailSaveOptions,
  result: Awaited<ReturnType<typeof persistNewsDetailContent>>,
  operationId: number,
  confirmedCreateId: NewsSaveRefs['confirmedCreateId'],
  navigateToCreatedDetail: ReturnType<typeof useCreatedNewsNavigation>
) => {
  const saved = result.saved;
  options.setLoadedItem(saved);
  if (options.mode === 'create') confirmedCreateId.current = saved.id;
  if (result.referenceFailed) {
    options.setRetryCreatedContentId(options.mode === 'create' ? saved.id : null);
    options.setStatusMessage({
      source: 'reference',
      text: options.pt('messages.mediaReferencePartialFailure'),
    });
    options.saveFeedback.markFailed(operationId);
    return;
  }

  if (options.mode === 'create') {
    options.setRetryCreatedContentId(saved.id);
    if (!options.completeCreateSave()) {
      options.setStatusMessage({
        source: 'navigation',
        text: options.pt('create.savedWithNewChanges'),
      });
      options.saveFeedback.reset();
      return;
    }
    options.saveFeedback.markSaved(operationId);
    try {
      await navigateToCreatedDetail(saved.id);
    } catch {
      options.setRetryCreatedContentId(saved.id);
      options.setStatusMessage({
        source: 'navigation',
        text: options.pt('messages.detailNavigationError'),
      });
      options.saveFeedback.markFailed(operationId);
    }
    return;
  }

  if (!options.completeCreateSave()) {
    options.setLoadedItem(saved);
    options.setStatusMessage({ source: 'recovered', text: options.pt('messages.saveRecovered') });
    options.saveFeedback.reset();
    return;
  }
  const nextValues = mapNewsItemToDetailFormValues(saved);
  options.methods.reset(nextValues);
  options.setRetryCreatedContentId(null);
  options.setLoadedItem(saved);
  options.setScheduledPublicationInput(toDatetimeLocalValue(nextValues.scheduledPublicationAt));
  options.setInvalidScheduledPublicationInput(false);
  options.setStatusMessage(null);
  options.saveFeedback.markSaved(operationId);
};

export const useNewsDetailSave = (options: NewsDetailSaveOptions) => {
  const confirmedCreateId = React.useRef<string | null>(null);
  const navigateToCreatedDetail = useCreatedNewsNavigation();
  const pendingSaveRef = React.useRef<PendingNewsSave | null>(null);
  const inFlight = React.useRef(false);
  const { checkSaveOutcome, checkingSave } = useNewsSaveRecovery(options, {
    pendingSaveRef,
    confirmedCreateId,
    inFlight,
  });

  const saveCurrentItem = options.methods.handleSubmit(
    async (values) => {
      if (inFlight.current || pendingSaveRef.current) return;
      if (
        !options.canSave ||
        (options.mode === 'create' && (options.retryCreatedContentId || confirmedCreateId.current))
      )
        return;
      if (
        didDeclineGlobalPush(
          values,
          options.loadedItem,
          options.pt,
          options.wasteTargetingAvailability
        )
      )
        return;
      if (options.mediaReferenceSync.hasPendingRetry) {
        options.setStatusMessage({
          source: 'reference',
          text: options.pt('messages.mediaReferencePartialFailure'),
        });
        return;
      }

      if (options.mode === 'edit' && !options.contentId) {
        options.setStatusMessage({ source: 'load', text: options.pt('messages.missingContent') });
        return;
      }

      inFlight.current = true;
      const mutationId = crypto.randomUUID();
      let contentSaveStarted = false;
      options.captureCreateSave();
      const operationId = options.saveFeedback.beginSaving();
      options.setMediaSavePhaseKey(null);
      try {
        const handledResult = await persistNewsDetailContent({
          values,
          mutationId,
          onContentSaveStarted: () => {
            contentSaveStarted = true;
          },
          contentId: options.contentId,
          mediaUsages: options.mediaUsages,
          loadedItem: options.loadedItem,
          actingPrincipalType: options.actingPrincipalType,
          hasWasteTargetingAccess: options.hasWasteTargetingAccess,
          requiresReferenceSync: options.requiresReferenceSync,
          setMediaSavePhaseKey: options.setMediaSavePhaseKey,
          mediaReferenceSync: options.mediaReferenceSync,
        });
        await completeNewsDetailSave(
          options,
          handledResult,
          operationId,
          confirmedCreateId,
          navigateToCreatedDetail
        );
      } catch (error) {
        const mediaError = error instanceof ContentMediaSaveError ? error : undefined;
        if (
          contentSaveStarted &&
          (mediaError?.status === 'outcome_unknown' ||
            readMainserverMutationFailureOutcome(error) === 'unknown')
        ) {
          const pending: PendingNewsSave = {
            operationId: mutationId,
            principal: options.actingPrincipalType,
            mediaUsages: options.mediaUsages,
            requiresReferenceSync: options.requiresReferenceSync,
            consumeMediaResult: options.mediaReferenceSync.consumeSaveResult,
            ...(mediaError ? { mediaError } : {}),
          };
          pendingSaveRef.current = pending;
          options.setPendingSave(pending);
          options.setStatusMessage({
            source: 'unknown',
            text: options.pt('messages.saveOutcomeUnknown'),
            requestId: readMainserverErrorRequestId(error),
          });
          options.saveFeedback.markFailed(operationId);
          return;
        }
        options.setStatusMessage(newsSaveErrorStatus(options.pt, error));
        options.saveFeedback.markFailed(operationId);
      } finally {
        inFlight.current = false;
      }
    },
    () => {
      if (!pendingSaveRef.current) {
        options.setStatusMessage(null);
        options.saveFeedback.reset();
      }
    }
  );

  return {
    navigateToCreatedDetail,
    saveCurrentItem,
    checkSaveOutcome,
    checkingSave,
    hasUnknownSave: options.pendingSave !== null,
  };
};
