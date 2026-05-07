import type { IamUserDetail } from '@sva/core';
import React from 'react';

import {
  asIamError,
  getUser,
  IamHttpError,
  sendPasswordSetupEmail,
  updateUser,
  type UpdateUserPayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { subscribeIamUsersUpdated } from '../lib/iam-user-events';
import { useAuth } from '../providers/auth-provider';

type UseUserResult = {
  readonly user: IamUserDetail | null;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly save: (payload: UpdateUserPayload) => Promise<IamUserDetail | null>;
  readonly resendPasswordSetupEmail?: () => Promise<boolean>;
};

const userLogger = createOperationLogger('user-hook', 'debug');

export const useUser = (userId: string): UseUserResult => {
  const { invalidatePermissions } = useAuth();
  const [user, setUser] = React.useState<IamUserDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    setMutationError(null);
  }, [userId]);

  const refetch = React.useCallback(async () => {
    logBrowserOperationStart(userLogger, 'user_detail_refetch_started', {
      operation: 'get_user',
      user_id: userId,
    });
    setIsLoading(true);
    setError(null);

    try {
      const response = await getUser(userId);
      setUser(response.data);
      logBrowserOperationSuccess(userLogger, 'user_detail_refetch_succeeded', {
        operation: 'get_user',
        user_id: userId,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        userLogger.info('permission_invalidated_after_403', {
          operation: 'get_user',
          status: resolvedError.status,
          error_code: resolvedError.code,
          user_id: userId,
        });
      }
      setUser(null);
      setError(resolvedError);
      logBrowserOperationFailure(userLogger, 'user_detail_refetch_failed', resolvedError, {
        operation: 'get_user',
        user_id: userId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, userId]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  React.useEffect(() => subscribeIamUsersUpdated(() => void refetch()), [refetch]);

  const save = React.useCallback(
    async (payload: UpdateUserPayload) => {
      setMutationError(null);
      logBrowserOperationStart(userLogger, 'user_save_started', {
        operation: 'update_user',
        user_id: userId,
      });
      try {
        const response = await updateUser(userId, payload);
        setUser(response.data);
        logBrowserOperationSuccess(userLogger, 'user_save_succeeded', {
          operation: 'update_user',
          user_id: userId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          userLogger.info('permission_invalidated_after_403', {
            operation: 'update_user',
            status: resolvedError.status,
            error_code: resolvedError.code,
            user_id: userId,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(userLogger, 'user_save_failed', resolvedError, {
          operation: 'update_user',
          user_id: userId,
        });
        return null;
      }
    },
    [invalidatePermissions, userId]
  );

  const resendPasswordSetupEmailAction = React.useCallback(async () => {
    setMutationError(null);
    logBrowserOperationStart(userLogger, 'user_password_setup_email_started', {
      operation: 'send_password_setup_email',
      user_id: userId,
    });

    try {
      await sendPasswordSetupEmail(userId);
      logBrowserOperationSuccess(userLogger, 'user_password_setup_email_succeeded', {
        operation: 'send_password_setup_email',
        user_id: userId,
      });
      return true;
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        userLogger.info('permission_invalidated_after_403', {
          operation: 'send_password_setup_email',
          status: resolvedError.status,
          error_code: resolvedError.code,
          user_id: userId,
        });
      }
      setMutationError(resolvedError);
      logBrowserOperationFailure(userLogger, 'user_password_setup_email_failed', resolvedError, {
        operation: 'send_password_setup_email',
        user_id: userId,
      });
      return false;
    }
  }, [invalidatePermissions, userId]);

  return {
    user,
    isLoading,
    error,
    mutationError,
    refetch,
    save,
    resendPasswordSetupEmail: resendPasswordSetupEmailAction,
  };
};
