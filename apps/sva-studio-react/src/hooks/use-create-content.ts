import React from 'react';

import { asIamError, createContent, type CreateContentPayload, type IamHttpError } from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { contentsLogger, PERMISSION_INVALIDATED_EVENT, type UseCreateContentResult } from './use-contents.shared.js';

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
        if (resolvedError.status === 401 || resolvedError.status === 403) {
          await invalidatePermissions();
          contentsLogger.info(PERMISSION_INVALIDATED_EVENT, {
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
