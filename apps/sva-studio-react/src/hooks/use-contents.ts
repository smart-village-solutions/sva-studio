import React from 'react';
import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem } from '@sva/core';

import {
  asIamError,
  createContent,
  getContent,
  getContentHistory,
  IamHttpError,
  listContents,
  updateContent,
  type CreateContentPayload,
  type UpdateContentPayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseContentsResult = {
  readonly contents: readonly IamContentListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
};

type UseContentDetailResult = {
  readonly content: IamContentDetail | null;
  readonly history: readonly IamContentHistoryEntry[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly updateContent: (payload: UpdateContentPayload) => Promise<boolean>;
};

type UseCreateContentResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly createContent: (payload: CreateContentPayload) => Promise<boolean>;
};

const contentsLogger = createOperationLogger('contents-hook', 'debug');

export const useContents = (): UseContentsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listContents, invalidatePermissions);

  return {
    contents: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
  };
};

export const useCreateContent = (): UseCreateContentResult => {
  const { invalidatePermissions } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const runMutation = React.useCallback(
    async (payload: CreateContentPayload) => {
      setMutationError(null);
      logBrowserOperationStart(contentsLogger, 'content_create_started', {
        operation: 'create_content',
      });
      try {
        await createContent(payload);
        logBrowserOperationSuccess(contentsLogger, 'content_create_succeeded', {
          operation: 'create_content',
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          contentsLogger.info('permission_invalidated_after_403', {
            operation: 'create_content',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(contentsLogger, 'content_create_failed', resolvedError, {
          operation: 'create_content',
        });
        return false;
      }
    },
    [invalidatePermissions]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    createContent: runMutation,
  };
};

export const useContentDetail = (contentId: string | null): UseContentDetailResult => {
  const { invalidatePermissions } = useAuth();
  const [content, setContent] = React.useState<IamContentDetail | null>(null);
  const [history, setHistory] = React.useState<readonly IamContentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    if (!contentId) {
      setContent(null);
      setHistory([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    logBrowserOperationStart(contentsLogger, 'content_detail_refetch_started', {
      operation: 'get_content_detail',
      content_id: contentId,
    });
    setIsLoading(true);
    setError(null);

    try {
      const [contentResponse, historyResponse] = await Promise.all([getContent(contentId), getContentHistory(contentId)]);
      setContent({
        ...contentResponse.data,
        history: historyResponse.data,
      });
      setHistory(historyResponse.data);
      logBrowserOperationSuccess(contentsLogger, 'content_detail_refetch_succeeded', {
        operation: 'get_content_detail',
        content_id: contentId,
        history_count: historyResponse.data.length,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        contentsLogger.info('permission_invalidated_after_403', {
          operation: 'get_content_detail',
          status: resolvedError.status,
          error_code: resolvedError.code,
          content_id: contentId,
        });
      }
      setContent(null);
      setHistory([]);
      setError(resolvedError);
      logBrowserOperationFailure(contentsLogger, 'content_detail_refetch_failed', resolvedError, {
        operation: 'get_content_detail',
        content_id: contentId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [contentId, invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const runMutation = React.useCallback(
    async (payload: UpdateContentPayload) => {
      setMutationError(null);
      if (!contentId) {
        return false;
      }
      logBrowserOperationStart(contentsLogger, 'content_update_started', {
        operation: 'update_content',
        content_id: contentId,
      });
      try {
        await updateContent(contentId, payload);
        await refetch();
        logBrowserOperationSuccess(contentsLogger, 'content_update_succeeded', {
          operation: 'update_content',
          content_id: contentId,
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          contentsLogger.info('permission_invalidated_after_403', {
            operation: 'update_content',
            status: resolvedError.status,
            error_code: resolvedError.code,
            content_id: contentId,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(contentsLogger, 'content_update_failed', resolvedError, {
          operation: 'update_content',
          content_id: contentId,
        });
        return false;
      }
    },
    [contentId, invalidatePermissions, refetch]
  );

  return {
    content,
    history,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    updateContent: runMutation,
  };
};
