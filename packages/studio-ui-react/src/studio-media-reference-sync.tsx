import * as React from 'react';
import type { ContentMediaReferenceSyncResult } from '@sva/plugin-sdk/content-media';

import { Button } from './button.js';
import { resolveContentMediaUsageDrafts } from './content-media-drafts.js';
import {
  revokeContentMediaUsageObjectUrls,
  type ContentMediaUsage,
} from './content-media-usage.js';

const setReferenceStatus = (
  usages: readonly ContentMediaUsage[],
  referenceStatus: 'failed' | 'synced'
): readonly ContentMediaUsage[] =>
  usages.map((usage) => (usage.assetId ? { ...usage, referenceStatus } : usage));

type MediaDraftResolutions = ContentMediaReferenceSyncResult<unknown>['resolutions'];

const isSubmittedMediaUsage = (
  usage: ContentMediaUsage,
  submitted: ContentMediaUsage,
  resolution: NonNullable<MediaDraftResolutions>[number] | undefined
): boolean => {
  // Media added or replaced after submission belongs to the next save.
  if (usage.localDraft) {
    return usage.localDraft.id === submitted.localDraft?.id && Boolean(resolution);
  }
  return (
    usage.assetId === (resolution?.assetId ?? submitted.assetId) &&
    usage.persistentUrl === (resolution?.persistentUrl ?? submitted.persistentUrl)
  );
};

const updateSavedUsage = (
  usage: ContentMediaUsage,
  submitted: ContentMediaUsage | undefined,
  resolutions: MediaDraftResolutions,
  status: 'failed' | 'synced'
): ContentMediaUsage => {
  if (!submitted) return usage;
  const resolution = resolutions?.find((entry) => entry.draftId === submitted.localDraft?.id);
  if (!isSubmittedMediaUsage(usage, submitted, resolution)) return usage;
  const resolved = usage.localDraft
    ? resolveContentMediaUsageDrafts([usage], resolutions ?? [])[0]!
    : usage;
  return usage.role === submitted.role && usage.sortOrder === submitted.sortOrder
    ? setReferenceStatus([resolved], status)[0]!
    : { ...resolved, referenceStatus: 'pending' as const };
};

export type StudioMediaReferenceSyncController = Readonly<{
  hasPendingRetry: boolean;
  retrying: boolean;
  consumeSaveResult: <TSaved>(
    result: ContentMediaReferenceSyncResult<TSaved>
  ) => Readonly<{ saved: TSaved; referenceFailed: boolean }>;
  retryReferenceSync: () => Promise<void>;
}>;

export const useStudioMediaReferenceSync = ({
  mediaUsages,
  setMediaUsages,
}: Readonly<{
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
}>): StudioMediaReferenceSyncController => {
  const [retryOperation, setRetryOperation] = React.useState<(() => Promise<void>) | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  const consumeSaveResult = React.useCallback(
    <TSaved,>(result: ContentMediaReferenceSyncResult<TSaved>) => {
      const savedUsages = new Map(mediaUsages.map((usage) => [usage.uiId, usage]));
      const resolutionIds = new Set(result.resolutions?.map((resolution) => resolution.draftId));
      const updateSavedUsages = (
        current: readonly ContentMediaUsage[],
        status: 'failed' | 'synced'
      ) =>
        current.map((usage) =>
          updateSavedUsage(usage, savedUsages.get(usage.uiId), result.resolutions, status)
        );
      if (result.resolutions?.length) {
        revokeContentMediaUsageObjectUrls(
          mediaUsages.filter((usage) => usage.localDraft && resolutionIds.has(usage.localDraft.id))
        );
      }
      if (result.status === 'reference_failed') {
        setRetryOperation(() => async () => {
          await result.retryReferenceSync();
          setMediaUsages((current) => updateSavedUsages(current, 'synced'));
        });
        setMediaUsages((current) => updateSavedUsages(current, 'failed'));
        return { saved: result.saved, referenceFailed: true } as const;
      }

      setRetryOperation(null);
      setMediaUsages((current) => updateSavedUsages(current, 'synced'));
      return { saved: result.saved, referenceFailed: false } as const;
    },
    [mediaUsages, setMediaUsages]
  );

  const retryReferenceSync = React.useCallback(async () => {
    if (!retryOperation || retrying) return;
    setRetrying(true);
    try {
      await retryOperation();
      setRetryOperation(null);
    } finally {
      setRetrying(false);
    }
  }, [retryOperation, retrying]);

  return {
    hasPendingRetry: retryOperation !== null,
    retrying,
    consumeSaveResult,
    retryReferenceSync,
  };
};

export const StudioMediaReferenceRetryAction = ({
  controller,
  label,
  pendingLabel = label,
  onSuccess,
  onFailure,
}: Readonly<{
  controller: StudioMediaReferenceSyncController;
  label: string;
  pendingLabel?: string;
  onSuccess: () => void | Promise<void>;
  onFailure: () => void;
}>) => {
  if (!controller.hasPendingRetry) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={controller.retrying}
      onClick={() => {
        void controller.retryReferenceSync().then(onSuccess, onFailure);
      }}
    >
      {controller.retrying ? pendingLabel : label}
    </Button>
  );
};
