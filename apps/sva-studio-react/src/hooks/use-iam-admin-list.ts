import React from 'react';

import { asIamError, type IamHttpError } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
  type BrowserOperationLogMeta,
} from '../lib/browser-operation-logging';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';

type ListResponse<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
};

type UseIamAdminListResult<TItem> = {
  readonly items: readonly TItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly refetchWithOutcome: () => Promise<boolean>;
  readonly clearMutationError: () => void;
  readonly setError: (error: IamHttpError | null) => void;
  readonly runMutationWithResult: <TResult>(
    action: () => Promise<TResult>,
    meta?: BrowserOperationLogMeta
  ) => Promise<TResult | null>;
  readonly runMutation: (
    action: () => Promise<unknown>,
    meta?: BrowserOperationLogMeta
  ) => Promise<boolean>;
};

const adminListLogger = createOperationLogger('iam-admin-list', 'debug');

export const useIamAdminList = <TItem>(
  listItems: () => Promise<ListResponse<TItem>>,
  refreshSession: () => Promise<void> | void,
  options: {
    enabled?: boolean;
    invalidateEffectiveAccessOnMutation?: boolean;
    onLoaded?: (response: ListResponse<TItem>) => void;
  } = {}
): UseIamAdminListResult<TItem> => {
  const enabled = options.enabled ?? true;
  const invalidateEffectiveAccessOnMutation = options.invalidateEffectiveAccessOnMutation ?? false;
  const onLoaded = options.onLoaded;
  const [items, setItems] = React.useState<readonly TItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(enabled);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const hasLoadedItemsRef = React.useRef(false);
  const latestRequestRef = React.useRef(0);
  const latestRequestOutcomeRef = React.useRef<Promise<boolean> | null>(null);

  const executeRefetch = React.useCallback(
    async (requestId: number): Promise<boolean> => {
      if (!enabled) {
        setItems([]);
        setIsLoading(false);
        setError(null);
        return false;
      }

      logBrowserOperationStart(adminListLogger, 'list_refetch_started');
      setIsLoading(true);
      setError(null);

      try {
        const response = await listItems();
        if (requestId !== latestRequestRef.current) {
          return (await latestRequestOutcomeRef.current) ?? false;
        }
        setItems(response.data);
        hasLoadedItemsRef.current = true;
        onLoaded?.(response);
        logBrowserOperationSuccess(
          adminListLogger,
          'list_refetch_succeeded',
          {
            item_count: response.data.length,
          },
          'debug'
        );
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (requestId !== latestRequestRef.current) {
          return (await latestRequestOutcomeRef.current) ?? false;
        }
        if (resolvedError.status === 401) {
          await refreshSession();
          adminListLogger.info('session_refreshed_after_401', {
            operation: 'list_refetch',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        if (!hasLoadedItemsRef.current) {
          setItems([]);
        }
        setError(resolvedError);
        logBrowserOperationFailure(adminListLogger, 'list_refetch_failed', resolvedError);
        return false;
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enabled, refreshSession, listItems, onLoaded]
  );

  const refetchWithOutcome = React.useCallback((): Promise<boolean> => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    const outcome = executeRefetch(requestId);
    latestRequestOutcomeRef.current = outcome;
    return outcome;
  }, [executeRefetch]);

  const refetch = React.useCallback(async () => {
    await refetchWithOutcome();
  }, [refetchWithOutcome]);

  React.useEffect(() => {
    if (!enabled) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  const runMutationWithResult = React.useCallback(
    async <TResult>(action: () => Promise<TResult>, meta: BrowserOperationLogMeta = {}) => {
      logBrowserOperationStart(adminListLogger, 'mutation_started', meta);
      setMutationError(null);
      try {
        const result = await action();
        if (invalidateEffectiveAccessOnMutation) {
          requestEffectiveAccessInvalidation();
        }
        await refetch();
        logBrowserOperationSuccess(adminListLogger, 'mutation_succeeded', meta);
        return result;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          adminListLogger.info('session_refreshed_after_401', {
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
    [invalidateEffectiveAccessOnMutation, refreshSession, refetch]
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
      refetchWithOutcome,
      clearMutationError,
      setError,
      runMutationWithResult,
      runMutation,
    }),
    [
      clearMutationError,
      error,
      isLoading,
      items,
      mutationError,
      refetch,
      refetchWithOutcome,
      runMutation,
      runMutationWithResult,
    ]
  );
};
