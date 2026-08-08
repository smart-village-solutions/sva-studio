import React from 'react';

import {
  asIamError,
  createContent,
  type CreateContentPayload,
  type IamHttpError,
} from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import {
  contentsLogger,
  SESSION_REFRESHED_EVENT,
  type UseCreateContentResult,
} from './use-contents.shared.js';

export const useCreateContent = (): UseCreateContentResult => {
  const { refreshSession } = useAuth();
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
        if (resolvedError.status === 401) {
          await refreshSession();
          contentsLogger.info(SESSION_REFRESHED_EVENT, {
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
    [refreshSession]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    createContent: runMutation,
  };
};
