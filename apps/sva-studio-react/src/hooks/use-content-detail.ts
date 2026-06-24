import React from 'react';
import type { IamContentDetail, IamContentHistoryEntry } from '@sva/core';

import {
  asIamError,
  getContent,
  getContentHistory,
  type IamHttpError,
  updateContent,
  type UpdateContentPayload,
} from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { contentsLogger, PERMISSION_INVALIDATED_EVENT, type UseContentDetailResult } from './use-contents.shared.js';

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
      if (resolvedError.status === 401 || resolvedError.status === 403) {
        await invalidatePermissions();
        contentsLogger.info(PERMISSION_INVALIDATED_EVENT, {
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
        if (resolvedError.status === 401 || resolvedError.status === 403) {
          await invalidatePermissions();
          contentsLogger.info(PERMISSION_INVALIDATED_EVENT, {
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
