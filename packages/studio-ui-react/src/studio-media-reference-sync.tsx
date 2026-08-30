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
      const resolvedUsages = result.resolutions?.length
        ? resolveContentMediaUsageDrafts(mediaUsages, result.resolutions)
        : mediaUsages;
      if (result.resolutions?.length) revokeContentMediaUsageObjectUrls(mediaUsages);

      if (result.status === 'reference_failed') {
        setRetryOperation(() => result.retryReferenceSync);
        setMediaUsages(setReferenceStatus(resolvedUsages, 'failed'));
        return { saved: result.saved, referenceFailed: true } as const;
      }

      setRetryOperation(null);
      setMediaUsages(setReferenceStatus(resolvedUsages, 'synced'));
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
      setMediaUsages((current) => setReferenceStatus(current, 'synced'));
    } finally {
      setRetrying(false);
    }
  }, [retryOperation, retrying, setMediaUsages]);

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
