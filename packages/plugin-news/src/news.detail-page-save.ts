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
  useStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { createNews, NewsApiError, saveNewsEditorItem, updateNews } from './news.api.js';
import { recoverNewsSave, type PendingNewsSave } from './news.detail-page-recovery.js';
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
  captureCreateSave: () => void;
  completeCreateSave: () => boolean;
  retryCreatedContentId: string | null;
  pendingSave: PendingNewsSave | null;
  setPendingSave: React.Dispatch<React.SetStateAction<PendingNewsSave | null>>;
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
  captureCreateSave,
  completeCreateSave,
  retryCreatedContentId,
  pendingSave,
  setPendingSave,
}: NewsDetailSaveOptions) => {
  const { reset } = methods;
  const confirmedCreateId = React.useRef<string | null>(null);
  const navigateToCreatedDetail = useCreatedNewsNavigation();
  const pendingSaveRef = React.useRef<PendingNewsSave | null>(null);
  const inFlight = React.useRef(false);
  const [checkingSave, setCheckingSave] = React.useState(false);
  const checkSaveOutcome = async () => {
    const pending = pendingSaveRef.current;
    if (!pending || inFlight.current || checkingSave) return;
    inFlight.current = true;
    setCheckingSave(true);
    try {
      const recovery = await recoverNewsSave(pending);
      if (recovery.outcome === 'not_applied') {
        pendingSaveRef.current = null;
        setPendingSave(null);
        setStatusMessage({ source: 'save', text: pt('messages.saveNotApplied') });
      } else if (recovery.outcome === 'succeeded') {
        const handled = pending.consumeMediaResult(recovery.result);
        if (mode === 'create') {
          confirmedCreateId.current = handled.saved.id;
          setRetryCreatedContentId(handled.saved.id);
        }
        setLoadedItem(handled.saved);
        // Recovery acknowledges the old operation and never resets the current draft.
        pendingSaveRef.current = null;
        setPendingSave(null);
        setStatusMessage({
          source: handled.referenceFailed ? 'reference' : 'recovered',
          text: pt(
            handled.referenceFailed
              ? 'messages.mediaReferencePartialFailure'
              : 'messages.saveRecovered'
          ),
        });
        saveFeedback.reset();
      } else {
        setStatusMessage({ source: 'unknown', text: pt('messages.saveOutcomeUnknown') });
      }
    } catch (error) {
      setStatusMessage({
        source: 'unknown',
        text: pt('messages.saveOutcomeCheckFailed'),
        requestId: readMainserverErrorRequestId(error),
      });
    } finally {
      inFlight.current = false;
      setCheckingSave(false);
    }
  };

  const saveCurrentItem = methods.handleSubmit(
    async (values) => {
      if (inFlight.current || pendingSaveRef.current) return;
      if (!canSave || (mode === 'create' && (retryCreatedContentId || confirmedCreateId.current)))
        return;
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

      inFlight.current = true;
      const mutationId = crypto.randomUUID();
      let contentSaveStarted = false;
      captureCreateSave();
      const operationId = saveFeedback.beginSaving();
      setMediaSavePhaseKey(null);
      try {
        const handledResult = await persistNewsDetailContent({
          values,
          mutationId,
          onContentSaveStarted: () => {
            contentSaveStarted = true;
          },
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
        setLoadedItem(saved);
        if (mode === 'create') confirmedCreateId.current = saved.id;
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
          setRetryCreatedContentId(saved.id);
          if (!completeCreateSave()) {
            setStatusMessage({ source: 'navigation', text: pt('create.savedWithNewChanges') });
            saveFeedback.reset();
            return;
          }
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

        if (!completeCreateSave()) {
          setLoadedItem(saved);
          setStatusMessage({ source: 'recovered', text: pt('messages.saveRecovered') });
          saveFeedback.reset();
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
        const mediaError = error instanceof ContentMediaSaveError ? error : undefined;
        if (
          contentSaveStarted &&
          (mediaError?.status === 'outcome_unknown' ||
            readMainserverMutationFailureOutcome(error) === 'unknown')
        ) {
          const pending: PendingNewsSave = {
            operationId: mutationId,
            principal: actingPrincipalType,
            mediaUsages,
            requiresReferenceSync,
            consumeMediaResult: mediaReferenceSync.consumeSaveResult,
            ...(mediaError ? { mediaError } : {}),
          };
          pendingSaveRef.current = pending;
          setPendingSave(pending);
          setStatusMessage({
            source: 'unknown',
            text: pt('messages.saveOutcomeUnknown'),
            requestId: readMainserverErrorRequestId(error),
          });
          saveFeedback.markFailed(operationId);
          return;
        }
        setStatusMessage({
          source: 'save',
          text: resolveNewsErrorMessage(pt, error, 'messages.saveError'),
          requestId: readMainserverErrorRequestId(error),
          ...(error instanceof NewsApiError ? { errorCode: error.code } : {}),
        });
        saveFeedback.markFailed(operationId);
      } finally {
        inFlight.current = false;
      }
    },
    () => {
      if (!pendingSaveRef.current) {
        setStatusMessage(null);
        saveFeedback.reset();
      }
    }
  );

  return {
    navigateToCreatedDetail,
    saveCurrentItem,
    checkSaveOutcome,
    checkingSave,
    hasUnknownSave: pendingSave !== null,
  };
};
