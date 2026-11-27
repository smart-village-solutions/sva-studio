import React from 'react';
import type { IamContentHistoryEntry } from '@sva/core';
import { useStudioTableQuery } from '@sva/studio-ui-react';

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
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';
import {
  contentsLogger,
  SESSION_REFRESHED_EVENT,
  type UseContentDetailResult,
} from './use-contents.shared.js';

const EMPTY_HISTORY: readonly IamContentHistoryEntry[] = [];

export const useContentDetail = (contentId: string | null): UseContentDetailResult => {
  const { refreshSession } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const detail = useStudioTableQuery(
    ['content-history', contentId],
    async (signal) => {
      if (!contentId) throw new Error('missing_content_id');

      logBrowserOperationStart(contentsLogger, 'content_detail_refetch_started', {
        operation: 'get_content_detail',
        content_id: contentId,
      });
      try {
        const [contentResponse, historyResponse] = await Promise.all([
          getContent(contentId, { signal }),
          getContentHistory(contentId, signal),
        ]);
        logBrowserOperationSuccess(contentsLogger, 'content_detail_refetch_succeeded', {
          operation: 'get_content_detail',
          content_id: contentId,
          history_count: historyResponse.data.length,
        });
        return { ...contentResponse.data, history: historyResponse.data };
      } catch (cause) {
        if (signal.aborted) throw cause;
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          contentsLogger.info(SESSION_REFRESHED_EVENT, {
            operation: 'get_content_detail',
            status: resolvedError.status,
            error_code: resolvedError.code,
            content_id: contentId,
          });
        }
        logBrowserOperationFailure(contentsLogger, 'content_detail_refetch_failed', resolvedError, {
          operation: 'get_content_detail',
          content_id: contentId,
        });
        throw resolvedError;
      }
    },
    Boolean(contentId)
  );
  const { refetch, refresh } = detail;

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
        await refresh(true);
        logBrowserOperationSuccess(contentsLogger, 'content_update_succeeded', {
          operation: 'update_content',
          content_id: contentId,
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.code === 'stale_mainserver_context') {
          requestEffectiveAccessInvalidation();
        }
        if (resolvedError.status === 401) {
          await refreshSession();
          contentsLogger.info(SESSION_REFRESHED_EVENT, {
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
    [contentId, refreshSession, refresh]
  );

  return {
    content: detail.data ?? null,
    history: detail.data?.history ?? EMPTY_HISTORY,
    isLoading: Boolean(contentId) && detail.state === 'loading',
    error: detail.error as IamHttpError | null,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    updateContent: runMutation,
  };
};
