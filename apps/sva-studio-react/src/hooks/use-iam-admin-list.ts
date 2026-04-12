import React from 'react';

import { asIamError, type IamHttpError } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
  type BrowserOperationLogMeta,
} from '../lib/browser-operation-logging';

type ListResponse<TItem> = {
  readonly data: readonly TItem[];
};

type UseIamAdminListResult<TItem> = {
  readonly items: readonly TItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly setError: (error: IamHttpError | null) => void;
  readonly runMutationWithResult: <TResult>(
    action: () => Promise<TResult>,
    meta?: BrowserOperationLogMeta
  ) => Promise<TResult | null>;
  readonly runMutation: (action: () => Promise<unknown>, meta?: BrowserOperationLogMeta) => Promise<boolean>;
};

const adminListLogger = createOperationLogger('iam-admin-list', 'debug');

export const useIamAdminList = <TItem>(
  listItems: () => Promise<ListResponse<TItem>>,
  invalidatePermissions: () => Promise<void> | void
): UseIamAdminListResult<TItem> => {
  const [items, setItems] = React.useState<readonly TItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    logBrowserOperationStart(adminListLogger, 'list_refetch_started');
    setIsLoading(true);
    setError(null);

    try {
      const response = await listItems();
      setItems(response.data);
      logBrowserOperationSuccess(
        adminListLogger,
        'list_refetch_succeeded',
        {
          item_count: response.data.length,
        },
        'debug'
      );
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        adminListLogger.info('permission_invalidated_after_403', {
          operation: 'list_refetch',
          status: resolvedError.status,
          error_code: resolvedError.code,
        });
      }
      setItems([]);
      setError(resolvedError);
      logBrowserOperationFailure(adminListLogger, 'list_refetch_failed', resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, listItems]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const runMutationWithResult = React.useCallback(
    async <TResult>(action: () => Promise<TResult>, meta: BrowserOperationLogMeta = {}) => {
      logBrowserOperationStart(adminListLogger, 'mutation_started', meta);
      setMutationError(null);
      try {
        const result = await action();
        await refetch();
        logBrowserOperationSuccess(adminListLogger, 'mutation_succeeded', meta);
        return result;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          adminListLogger.info('permission_invalidated_after_403', {
            operation: typeof meta.operation === 'string' ? meta.operation : 'mutation',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(adminListLogger, 'mutation_failed', resolvedError, meta);
        return null;
      }
    },
    [invalidatePermissions, refetch]
  );

  const runMutation = React.useCallback(
    async (action: () => Promise<unknown>, meta: BrowserOperationLogMeta = {}) =>
      (await runMutationWithResult(action, meta)) !== null,
    [runMutationWithResult]
  );

  const clearMutationError = React.useCallback(() => {
    setMutationError(null);
  }, []);

  return React.useMemo(
    () => ({
      items,
      isLoading,
      error,
      mutationError,
      refetch,
      clearMutationError,
      setError,
      runMutationWithResult,
      runMutation,
    }),
    [clearMutationError, error, isLoading, items, mutationError, refetch, runMutation, runMutationWithResult]
  );
};
