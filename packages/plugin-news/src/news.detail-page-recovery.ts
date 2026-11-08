import * as React from 'react';
import { ContentMediaSaveError } from '@sva/plugin-sdk/content-media';
import {
  abandonHostMediaContentSaveOperation,
  commitHostMediaContentSaveOperation,
  markHostMediaContentSaveOperationContentSaved,
  replaceHostMediaReferences,
  type ContentMediaReferenceSyncResult,
} from '@sva/plugin-sdk';
import {
  contentMediaUsageToReference,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  type StudioMediaReferenceSyncController,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { readMainserverErrorRequestId } from '@sva/plugin-sdk';
import type { PluginTranslator, StatusMessage } from './news.detail-page.helpers.js';
import { getNewsDetail, getNewsSaveOperation } from './news.api.js';
import { NEWS_CONTENT_TYPE } from './news.constants.js';
import type { NewsContentItem } from './news.types.js';

export type PendingNewsSave = Readonly<{
  operationId: string;
  principal: MainserverPrincipalType;
  mediaUsages: readonly ContentMediaUsage[];
  requiresReferenceSync: boolean;
  mediaError?: ContentMediaSaveError;
  consumeMediaResult: StudioMediaReferenceSyncController['consumeSaveResult'];
}>;

/** Checks the original operation; never repeats a content POST/PATCH. */
export const recoverNewsSave = async (
  pending: PendingNewsSave
): Promise<
  | Readonly<{ outcome: 'pending' | 'unknown' | 'not_applied' }>
  | Readonly<{ outcome: 'succeeded'; result: ContentMediaReferenceSyncResult<NewsContentItem> }>
> => {
  const fetch = globalThis.fetch.bind(globalThis);
  if (pending.mediaError?.status === 'cleanup_pending') {
    await abandonHostMediaContentSaveOperation({
      fetch,
      operationId: pending.mediaError.operationId,
    });
    return { outcome: 'not_applied' };
  }
  const status = await getNewsSaveOperation(pending.operationId, pending.principal);
  if (status.outcome === 'not_applied') {
    if (pending.mediaError)
      await abandonHostMediaContentSaveOperation({
        fetch,
        operationId: pending.mediaError.operationId,
      });
    return { outcome: 'not_applied' };
  }
  if (status.outcome !== 'succeeded' || !status.contentId) {
    return { outcome: status.outcome === 'pending' ? 'pending' : 'unknown' };
  }
  // Detail read independently checks current resource permissions.
  const { data: saved } = await getNewsDetail(status.contentId, pending.principal);
  const resolutions = pending.mediaError?.resolutions ?? [];
  const sync = async () => {
    if (pending.mediaError) {
      await markHostMediaContentSaveOperationContentSaved({
        fetch,
        operationId: pending.mediaError.operationId,
        targetId: saved.id,
      });
      await commitHostMediaContentSaveOperation({
        fetch,
        operationId: pending.mediaError.operationId,
      });
    } else if (pending.requiresReferenceSync) {
      await replaceHostMediaReferences({
        fetch,
        targetType: NEWS_CONTENT_TYPE,
        targetId: saved.id,
        references: pending.mediaUsages.flatMap((usage) => {
          const reference = contentMediaUsageToReference(usage);
          return reference ? [reference] : [];
        }),
      });
    }
  };
  try {
    await sync();
    return { outcome: 'succeeded', result: { status: 'complete', saved, resolutions } };
  } catch {
    return {
      outcome: 'succeeded',
      result: {
        status: 'reference_failed',
        saved,
        resolutions,
        retryReferenceSync: sync,
      },
    };
  }
};

export type NewsSaveRecoveryOptions = Readonly<{
  mode: 'create' | 'edit';
  pt: PluginTranslator;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setRetryCreatedContentId: React.Dispatch<React.SetStateAction<string | null>>;
  setLoadedItem: React.Dispatch<React.SetStateAction<NewsContentItem | null>>;
  setPendingSave: React.Dispatch<React.SetStateAction<PendingNewsSave | null>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
}>;

export type NewsSaveRefs = Readonly<{
  pendingSaveRef: React.MutableRefObject<PendingNewsSave | null>;
  confirmedCreateId: React.MutableRefObject<string | null>;
  inFlight: React.MutableRefObject<boolean>;
}>;

export const useNewsSaveRecovery = (
  {
    mode,
    pt,
    saveFeedback,
    setRetryCreatedContentId,
    setLoadedItem,
    setPendingSave,
    setStatusMessage,
  }: NewsSaveRecoveryOptions,
  { pendingSaveRef, confirmedCreateId, inFlight }: NewsSaveRefs
) => {
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

  return { checkSaveOutcome, checkingSave };
};
