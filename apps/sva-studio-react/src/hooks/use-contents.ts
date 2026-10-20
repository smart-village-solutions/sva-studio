import React from 'react';
import type { ApiPagination, IamContentListItem, IamContentListQuery } from '@sva/core';

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
import { useOrganizationContext } from './use-organization-context';
import { credentialRecoveryErrorCodes } from '../lib/iam-content-list-api.shared';
import type { ContentCredentialRecovery } from '../lib/iam-api-content-types';
import { useIamAdminList } from './use-iam-admin-list';
import { contentsLogger, SESSION_REFRESHED_EVENT } from './use-contents.shared.js';

type UseContentsResult = {
  readonly contents: readonly IamContentListItem[];
  readonly pagination: ApiPagination;
  readonly metadata: IamContentListMetadata | null;
  readonly credentialRecovery?: readonly ContentCredentialRecovery[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly refetchWithOutcome: () => Promise<boolean>;
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
  readonly failedContentIds: readonly string[];
  readonly failedCount: number;
  readonly refreshFailed: boolean;
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

const reusePaginationIfUnchanged = (current: ApiPagination, next: ApiPagination): ApiPagination =>
  current.page === next.page && current.pageSize === next.pageSize && current.total === next.total
    ? current
    : next;

const shouldRevalidateContentProjection = (
  enabled: boolean,
  metadata: IamContentListMetadata | null
): boolean =>
  enabled &&
  metadata !== null &&
  (metadata.hasRunningMainserverSync ||
    metadata.hasStaleMainserverContent ||
    metadata.mainserverSyncStates.some((state) => state.snapshotState?.startsWith('partial_')));

const getRefreshProjectionState = (
  metadata: IamContentListMetadata | null,
  visibleTypes: IamContentListQuery['visibleTypes']
): readonly string[] =>
  metadata?.mainserverSyncStates
    ?.map((entry) => entry.contentType)
    .filter((contentType) => typeof contentType === 'string' && contentType.length > 0) ??
  visibleTypes?.filter(
    (contentType) => typeof contentType === 'string' && contentType.length > 0
  ) ??
  [];

const useContentProjectionRevalidation = (
  shouldRevalidate: boolean,
  refetch: () => Promise<unknown>
): void => {
  React.useEffect(() => {
    if (!shouldRevalidate) return;

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
          delayMs = Math.min(Math.round(delayMs * 1.5), 15_000);
          poll();
        });
      }, delayMs);
    };
    poll();
    return () => {
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
  const { refreshSession, user } = useAuth();
  const organizationContext = useOrganizationContext();
  const enabled = options.enabled ?? true;
  const [pagination, setPagination] = React.useState<ApiPagination>(DEFAULT_CONTENT_PAGINATION);
  const [metadata, setMetadata] = React.useState<IamContentListMetadata | null>(null);
  const [refreshProjectionPending, setRefreshProjectionPending] = React.useState(false);
  const [credentialRecovery, setCredentialRecovery] = React.useState<
    readonly ContentCredentialRecovery[]
  >([]);
  const recoveryAttempted = React.useRef(new Set<string>());
  const scope = JSON.stringify([
    user?.id,
    user?.instanceId,
    organizationContext.context?.activeOrganizationId,
    query.type,
    query.visibleTypes,
    enabled,
  ]);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const currentScope = React.useRef(scope);
  currentScope.current = scope;
  React.useEffect(() => {
    setCredentialRecovery([]);
    setRefreshProjectionPending(false);
  }, [scope]);
  const listItems = React.useCallback(() => listContents(query), [query]);
  const handleLoaded = React.useCallback(
    (response: {
      readonly pagination?: ApiPagination;
      readonly metadata?: IamContentListMetadata;
    }) => {
      const nextPagination = response.pagination ?? DEFAULT_CONTENT_PAGINATION;
      setPagination((current) => reusePaginationIfUnchanged(current, nextPagination));
      setMetadata(response.metadata ?? null);
      if (
        !response.metadata ||
        (!response.metadata.hasBlockingSyncGap &&
          response.metadata.mainserverSyncStates.every((state) => !state.lastErrorCode))
      )
        setCredentialRecovery([]);
    },
    []
  );
  const adminList = useIamAdminList(listItems, refreshSession, {
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

  useContentProjectionRevalidation(
    shouldRevalidateContentProjection(enabled, metadata) ||
      (enabled && adminList.error?.status === 503 && credentialRecovery.length === 0),
    adminList.refetch
  );

  const failedState = metadata?.mainserverSyncStates.find(
    (entry) => entry.lastErrorCode && credentialRecoveryErrorCodes.has(entry.lastErrorCode)
  );
  const recoveryError = failedState?.lastErrorCode ?? adminList.error?.code;
  const failureKey = `${scope}:${failedState?.lastFailedAt ?? recoveryError}`;
  React.useEffect(() => {
    if (
      !enabled ||
      adminList.isLoading ||
      refreshProjectionPending ||
      !recoveryError ||
      !credentialRecoveryErrorCodes.has(recoveryError) ||
      failedState?.isSyncRunning ||
      failedState?.credentialRecovery ||
      recoveryAttempted.current.has(failureKey)
    )
      return;
    recoveryAttempted.current.add(failureKey);
    const capturedScope = scope;
    setRefreshProjectionPending(true);
    void refreshProjectedContents({
      visibleTypes: query.type ? [query.type] : query.visibleTypes,
      recoverCredentials: true,
      ...(adminList.error?.requestId ? { originalRequestId: adminList.error.requestId } : {}),
    })
      .then(async (response) => {
        if (!mounted.current || currentScope.current !== capturedScope) return;
        if (response.data.credentialRecovery)
          setCredentialRecovery(response.data.credentialRecovery);
        // The server may still be finishing the original refresh; ordinary reads keep observing it.
        if (response.data.status === 'already_running')
          recoveryAttempted.current.delete(failureKey);
        await adminList.refetch();
      })
      .catch((cause: unknown) => {
        if (!mounted.current || currentScope.current !== capturedScope) return;
        const error = asIamError(cause);
        setCredentialRecovery([
          {
            instanceId: user?.instanceId ?? '',
            contentType: query.type ?? query.visibleTypes?.[0] ?? '',
            source: 'unknown',
            outcome: 'failed',
            reasonCode: 'recovery_failed',
            occurredAt: new Date().toISOString(),
            ...(error.requestId ? { requestId: error.requestId } : {}),
            ...(adminList.error?.requestId ? { originalRequestId: adminList.error.requestId } : {}),
          },
        ]);
      })
      .finally(() => {
        if (mounted.current && currentScope.current === capturedScope)
          setRefreshProjectionPending(false);
      });
  }, [
    enabled,
    scope,
    failureKey,
    recoveryError,
    failedState?.isSyncRunning,
    failedState?.credentialRecovery,
    adminList.isLoading,
    refreshProjectionPending,
    query.type,
    query.visibleTypes,
    adminList.error?.requestId,
    adminList.refetch,
    user?.instanceId,
  ]);

  const runBulkMutation = React.useCallback(
    async (
      input: ContentBulkMutationInput,
      mutateOne: (
        contentId: string,
        content: IamContentListItem | undefined
      ) => Promise<'accepted' | 'skipped'>
    ): Promise<ContentBulkMutationResult> =>
      runContentBulkMutation(input, adminList.items, adminList.refetchWithOutcome, mutateOne),
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
    () => getRefreshProjectionState(metadata, query.visibleTypes),
    [metadata, query.visibleTypes]
  );

  const refreshProjectionForList = React.useCallback(
    async (input: { readonly force?: boolean } = {}) => {
      setRefreshProjectionPending(true);
      const capturedScope = scope;
      try {
        const response = await refreshProjectedContents({
          ...(refreshProjectionState.length > 0 ? { visibleTypes: refreshProjectionState } : {}),
          ...(input.force ? { force: true } : {}),
          ...(input.force && recoveryError && credentialRecoveryErrorCodes.has(recoveryError)
            ? { recoverCredentials: true }
            : {}),
        });
        if (!mounted.current || currentScope.current !== capturedScope) return false;
        if (response.data?.credentialRecovery)
          setCredentialRecovery(response.data.credentialRecovery);
        const refreshed = await adminList.refetchWithOutcome();
        return refreshed && response.data?.status !== 'failed';
      } catch (cause) {
        if (!mounted.current || currentScope.current !== capturedScope) return false;
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          contentsLogger.info(SESSION_REFRESHED_EVENT, {
            operation: 'refresh_projected_contents',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        adminList.setError(resolvedError);
        return false;
      } finally {
        if (mounted.current && currentScope.current === capturedScope)
          setRefreshProjectionPending(false);
      }
    },
    [adminList, refreshSession, refreshProjectionState, scope, recoveryError]
  );

  return {
    contents: adminList.items,
    pagination,
    metadata,
    credentialRecovery,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    refetchWithOutcome: adminList.refetchWithOutcome,
    refreshProjection: refreshProjectionForList,
    refreshProjectionPending,
    clearMutationError: adminList.clearMutationError,
    archiveContents,
    deleteContents,
  };
};

export { useCreateContent } from './use-create-content.js';
export { useContentDetail } from './use-content-detail.js';
