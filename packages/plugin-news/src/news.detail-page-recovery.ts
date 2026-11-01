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
} from '@sva/studio-ui-react';
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
