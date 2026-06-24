import React from 'react';
import type {
  ApiPagination,
  IamContentListItem,
  IamContentListQuery,
} from '@sva/core';

import {
  asIamError,
  deleteContent,
  IamHttpError,
  listContents,
  refreshProjectedContents,
  type IamContentListMetadata,
  updateContent,
} from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';
import { contentsLogger, PERMISSION_INVALIDATED_EVENT } from './use-contents.shared.js';

type UseContentsResult = {
  readonly contents: readonly IamContentListItem[];
  readonly pagination: ApiPagination;
  readonly metadata: IamContentListMetadata | null;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly refreshProjection: (input?: { readonly force?: boolean }) => Promise<boolean>;
  readonly refreshProjectionPending: boolean;
  readonly clearMutationError: () => void;
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
  readonly failedCount: number;
  readonly skippedCount: number;
}>;

type UseContentsOptions = Readonly<{
  readonly enabled?: boolean;
}>;

const DEFAULT_CONTENT_PAGINATION = {
  page: 1,
  pageSize: 25,
  total: 0,
} as const satisfies ApiPagination;

export const useContents = (query: IamContentListQuery, options: UseContentsOptions = {}): UseContentsResult => {
  const { invalidatePermissions } = useAuth();
  const enabled = options.enabled ?? true;
  const [pagination, setPagination] = React.useState<ApiPagination>(DEFAULT_CONTENT_PAGINATION);
  const [metadata, setMetadata] = React.useState<IamContentListMetadata | null>(null);
  const [refreshProjectionPending, setRefreshProjectionPending] = React.useState(false);
  const listItems = React.useCallback(() => listContents(query), [query]);
  const handleLoaded = React.useCallback(
    (response: { readonly pagination?: ApiPagination; readonly metadata?: IamContentListMetadata }) => {
      const nextPagination = response.pagination ?? DEFAULT_CONTENT_PAGINATION;
      setPagination((currentPagination) =>
        currentPagination.page === nextPagination.page &&
        currentPagination.pageSize === nextPagination.pageSize &&
        currentPagination.total === nextPagination.total
          ? currentPagination
          : nextPagination
      );
      setMetadata(response.metadata ?? null);
    },
    []
  );
  const adminList = useIamAdminList(listItems, invalidatePermissions, {
    enabled,
    onLoaded: handleLoaded,
  });

  React.useEffect(() => {
    if (enabled) {
      return;
    }

    setMetadata(null);
    setPagination(DEFAULT_CONTENT_PAGINATION);
  }, [enabled]);

  const runBulkMutation = React.useCallback(
    async (
      input: ContentBulkMutationInput,
      mutateOne: (contentId: string, content: IamContentListItem | undefined) => Promise<'accepted' | 'skipped'>
    ): Promise<ContentBulkMutationResult> => {
      const byId = new Map(adminList.items.map((content) => [content.id, content] as const));
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
      let failedCount = 0;
      let skippedCount = 0;

      for (const contentId of input.contentIds) {
        try {
          const outcome = await mutateOne(contentId, byId.get(contentId));
          if (outcome === 'accepted') {
            acceptedCount += 1;
          } else {
            skippedCount += 1;
          }
        } catch (cause) {
          failedCount += 1;
          logBrowserOperationFailure(contentsLogger, 'content_bulk_action_item_failed', cause, {
            ...meta,
            content_id: contentId,
          });
        }
      }

      if (acceptedCount > 0) {
        await adminList.refetch();
      }

      const result = { acceptedCount, failedCount, skippedCount } as const;
      logBrowserOperationSuccess(
        contentsLogger,
        'content_bulk_action_succeeded',
        {
          ...meta,
          accepted_count: acceptedCount,
          failed_count: failedCount,
          skipped_count: skippedCount,
        },
        'info'
      );
      return result;
    },
    [adminList]
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

  const refreshProjectionState = React.useMemo(
    () =>
      metadata?.mainserverSyncStates
        ?.map((entry) => entry.contentType)
        .filter((contentType) => typeof contentType === 'string' && contentType.length > 0) ??
      query.visibleTypes?.filter((contentType) => typeof contentType === 'string' && contentType.length > 0) ??
      [],
    [metadata, query.visibleTypes]
  );

  const refreshProjectionForList = React.useCallback(
    async (input: { readonly force?: boolean } = {}) => {
      setRefreshProjectionPending(true);
      try {
        await refreshProjectedContents({
          ...(refreshProjectionState.length > 0 ? { visibleTypes: refreshProjectionState } : {}),
          ...(input.force ? { force: true } : {}),
        });
        await adminList.refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401 || resolvedError.status === 403) {
          await invalidatePermissions();
          contentsLogger.info(PERMISSION_INVALIDATED_EVENT, {
            operation: 'refresh_projected_contents',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        adminList.setError(resolvedError);
        return false;
      } finally {
        setRefreshProjectionPending(false);
      }
    },
    [adminList, invalidatePermissions, refreshProjectionState]
  );

  return {
    contents: adminList.items,
    pagination,
    metadata,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    refreshProjection: refreshProjectionForList,
    refreshProjectionPending,
    clearMutationError: adminList.clearMutationError,
    archiveContents,
    deleteContents,
  };
};

export { useCreateContent } from './use-create-content.js';
export { useContentDetail } from './use-content-detail.js';
