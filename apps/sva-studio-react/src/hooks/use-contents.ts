import React from 'react';
import { useStudioTableQuery, useStudioTableInvalidation } from '@sva/studio-ui-react';
import type { ApiPagination, IamContentListItem, IamContentListQuery } from '@sva/core';

import {
  asIamError,
  deleteContent,
  IamHttpError,
  listContents,
  type IamContentListMetadata,
  updateContent,
} from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import type { ContentCredentialRecovery } from '../lib/iam-api-content-types';
import { contentsLogger } from './use-contents.shared.js';
import { useContentCredentialRecovery } from './use-content-credential-recovery';

type UseContentsResult = {
  readonly contents: readonly IamContentListItem[];
  readonly pagination: ApiPagination;
  readonly metadata: IamContentListMetadata | null;
  readonly credentialRecovery?: readonly ContentCredentialRecovery[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly refetchWithOutcome: () => Promise<boolean>;
  readonly refreshProjection: (input?: { readonly force?: boolean }) => Promise<boolean>;
  readonly refreshProjectionPending: boolean;
  readonly archiveContents: (input: ContentBulkMutationInput) => Promise<ContentBulkMutationResult>;
  readonly deleteContents: (input: ContentBulkMutationInput) => Promise<ContentBulkMutationResult>;
};

export type ContentBulkMutationInput = Readonly<{
  readonly actionId: 'content.archive' | 'content.delete';
  readonly contentIds: readonly string[];
  readonly matchingCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly selectionMode: 'explicitIds' | 'currentPage' | 'allMatchingQuery';
  readonly sort?: {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
  };
  readonly statusFilter?: string;
}>;

export type ContentBulkMutationResult = Readonly<{
  readonly acceptedCount: number;
  readonly failedContentIds: readonly string[];
  readonly failedCount: number;
  readonly refreshFailed: boolean;
  readonly skippedCount: number;
}>;

type UseContentsOptions = Readonly<{
  readonly enabled?: boolean;
}>;

const EMPTY_CONTENTS: readonly IamContentListItem[] = [];
const DEFAULT_CONTENT_PAGINATION = {
  page: 1,
  pageSize: 25,
  total: 0,
} as const satisfies ApiPagination;

const shouldRevalidateContentProjection = (
  enabled: boolean,
  metadata: IamContentListMetadata | null
): boolean =>
  enabled &&
  metadata !== null &&
  (metadata.hasRunningMainserverSync ||
    metadata.hasStaleMainserverContent ||
    metadata.mainserverSyncStates.some((state) => state.snapshotState?.startsWith('partial_')));

const useContentProjectionRevalidation = (
  shouldRevalidate: boolean,
  refetch: () => Promise<unknown>
): void => {
  React.useEffect(() => {
    if (!shouldRevalidate) return;

    let cancelled = false;
    let delayMs = 2_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      timer = setTimeout(() => {
        if (document.visibilityState !== 'visible') {
          delayMs = Math.min(delayMs * 2, 30_000);
          poll();
          return;
        }
        void refetch().finally(() => {
          if (cancelled) return;
          delayMs = Math.min(Math.round(delayMs * 1.5), 15_000);
          poll();
        });
      }, delayMs);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refetch, shouldRevalidate]);
};

const runContentBulkMutation = async (
  input: ContentBulkMutationInput,
  items: readonly IamContentListItem[],
  refetchWithOutcome: () => Promise<boolean>,
  mutateOne: (
    contentId: string,
    content: IamContentListItem | undefined
  ) => Promise<'accepted' | 'skipped'>
): Promise<ContentBulkMutationResult> => {
  const byId = new Map(items.map((content) => [content.id, content] as const));
  const meta = {
    action_id: input.actionId,
    resource_id: 'content',
    selection_mode: input.selectionMode,
    requested_count: input.contentIds.length,
    matching_count: input.matchingCount,
    page: input.page,
    page_size: input.pageSize,
    ...(input.statusFilter ? { status_filter: input.statusFilter } : {}),
    ...(input.sort ? { sort_field: input.sort.field, sort_direction: input.sort.direction } : {}),
  } as const;

  logBrowserOperationStart(contentsLogger, 'content_bulk_action_started', meta);
  let acceptedCount = 0;
  const failedContentIds: string[] = [];
  let failedCount = 0;
  let skippedCount = 0;

  for (const contentId of input.contentIds) {
    try {
      const outcome = await mutateOne(contentId, byId.get(contentId));
      if (outcome === 'accepted') acceptedCount += 1;
      else skippedCount += 1;
    } catch (cause) {
      failedContentIds.push(contentId);
      failedCount += 1;
      logBrowserOperationFailure(contentsLogger, 'content_bulk_action_item_failed', cause, {
        ...meta,
        content_id: contentId,
      });
    }
  }

  const refreshFailed = acceptedCount > 0 && !(await refetchWithOutcome());
  if (refreshFailed) {
    contentsLogger.warn('content_bulk_action_refresh_failed', {
      ...meta,
      accepted_count: acceptedCount,
    });
  }

  const result = {
    acceptedCount,
    failedContentIds,
    failedCount,
    refreshFailed,
    skippedCount,
  } as const;
  logBrowserOperationSuccess(
    contentsLogger,
    'content_bulk_action_succeeded',
    {
      ...meta,
      accepted_count: acceptedCount,
      failed_count: failedCount,
      refresh_failed: refreshFailed,
      skipped_count: skippedCount,
    },
    'info'
  );
  return result;
};

export const useContents = (
  query: IamContentListQuery,
  options: UseContentsOptions = {}
): UseContentsResult => {
  const { refreshSession } = useAuth();
  const enabled = options.enabled ?? true;
  const invalidate = useStudioTableInvalidation();
  const [projectionError, setError] = React.useState<IamHttpError | null>(null);
  const list = useStudioTableQuery(
    ['contents', query],
    async (signal) => {
      try {
        return await listContents(query, signal);
      } catch (cause) {
        if (signal.aborted) throw cause;
        const error = asIamError(cause);
        if (error.status === 401) await refreshSession();
        throw error;
      }
    },
    enabled
  );
  const { data: response } = list;
  const contents = response?.data ?? EMPTY_CONTENTS;
  const metadata = response?.metadata ?? null;
  const error = enabled ? ((list.error as IamHttpError | null) ?? projectionError) : null;

  React.useEffect(() => setError(null), [enabled, query]);

  const refetchWithOutcome = React.useCallback(() => {
    setError(null);
    return list.refetch();
  }, [list.refetch]);
  const refetch = React.useCallback(async () => {
    await refetchWithOutcome();
  }, [refetchWithOutcome]);
  const adminList = {
    isLoading: list.isFetching,
    error,
    refetch,
    refetchWithOutcome,
    setError,
  };

  const {
    credentialRecovery,
    refreshProjectionPending,
    refreshProjection: refreshProjectionForList,
  } = useContentCredentialRecovery(query, enabled, metadata, adminList);

  useContentProjectionRevalidation(
    shouldRevalidateContentProjection(enabled, metadata) ||
      (enabled && adminList.error?.status === 503 && credentialRecovery.length === 0),
    adminList.refetch
  );

  const runBulkMutation = React.useCallback(
    async (
      input: ContentBulkMutationInput,
      mutateOne: (
        contentId: string,
        content: IamContentListItem | undefined
      ) => Promise<'accepted' | 'skipped'>
    ): Promise<ContentBulkMutationResult> =>
      runContentBulkMutation(
        input,
        contents,
        async () => {
          await invalidate(['contents'], false);
          return refetchWithOutcome();
        },
        mutateOne
      ),
    [contents, invalidate, refetchWithOutcome]
  );

  const archiveContents = React.useCallback(
    async (input: ContentBulkMutationInput): Promise<ContentBulkMutationResult> =>
      runBulkMutation(input, async (contentId, content) => {
        if (content?.status === 'archived') {
          return 'skipped';
        }

        await updateContent(contentId, { status: 'archived' });
        return 'accepted';
      }),
    [runBulkMutation]
  );

  const deleteContents = React.useCallback(
    async (input: ContentBulkMutationInput): Promise<ContentBulkMutationResult> =>
      runBulkMutation(input, async (contentId) => {
        await deleteContent(contentId);
        return 'accepted';
      }),
    [runBulkMutation]
  );

  return {
    contents,
    pagination: response?.pagination ?? DEFAULT_CONTENT_PAGINATION,
    metadata,
    credentialRecovery,
    isLoading: enabled && list.state === 'loading' && error === null,
    error,
    refetch,
    refetchWithOutcome,
    refreshProjection: refreshProjectionForList,
    refreshProjectionPending,
    archiveContents,
    deleteContents,
  };
};

export { useCreateContent } from './use-create-content.js';
export { useContentDetail } from './use-content-detail.js';
