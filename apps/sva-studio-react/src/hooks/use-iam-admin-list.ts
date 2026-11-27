import React from 'react';
import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';

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

const EMPTY_ITEMS: readonly never[] = [];
const adminListLogger = createOperationLogger('iam-admin-list', 'debug');

export const useIamAdminList = <TItem>(
  listItems: () => Promise<ListResponse<TItem>>,
  refreshSession: () => Promise<void> | void,
  options: {
    resource: string;
    enabled?: boolean;
    invalidateEffectiveAccessOnMutation?: boolean;
  }
): UseIamAdminListResult<TItem> => {
  const enabled = options.enabled ?? true;
  const invalidateEffectiveAccessOnMutation = options.invalidateEffectiveAccessOnMutation ?? false;
  const { resource } = options;
  const invalidate = useStudioTableInvalidation();
  const [manualError, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const latestRequestOutcomeRef = React.useRef<Promise<boolean> | null>(null);

  const list = useStudioTableQuery(
    [resource],
    async (signal) => {
      logBrowserOperationStart(adminListLogger, 'list_refetch_started');
      try {
        const response = await listItems();
        logBrowserOperationSuccess(
          adminListLogger,
          'list_refetch_succeeded',
          { item_count: response.data.length },
          'debug'
        );
        return response;
      } catch (cause) {
        if (signal.aborted) throw cause;
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          adminListLogger.info('session_refreshed_after_401', {
            operation: 'list_refetch',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        logBrowserOperationFailure(adminListLogger, 'list_refetch_failed', resolvedError);
        throw resolvedError;
      }
    },
    enabled
  );

  const refetchWithOutcome = React.useCallback((): Promise<boolean> => {
    setError(null);
    const outcome: Promise<boolean> = list
      .refetch()
      .then((success) =>
        latestRequestOutcomeRef.current === outcome
          ? success
          : (latestRequestOutcomeRef.current ?? false)
      );
    latestRequestOutcomeRef.current = outcome;
    return outcome;
  }, [list.refetch]);

  const refetch = React.useCallback(async () => {
    await refetchWithOutcome();
  }, [refetchWithOutcome]);

  const runMutationWithResult = React.useCallback(
    async <TResult>(action: () => Promise<TResult>, meta: BrowserOperationLogMeta = {}) => {
      logBrowserOperationStart(adminListLogger, 'mutation_started', meta);
      setMutationError(null);
      try {
        const result = await action();
        if (invalidateEffectiveAccessOnMutation) {
          requestEffectiveAccessInvalidation();
        }
        await invalidate([resource], false);
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
    [invalidateEffectiveAccessOnMutation, invalidate, refreshSession, refetch, resource]
  );

  const runMutation = React.useCallback(
    async (action: () => Promise<unknown>, meta: BrowserOperationLogMeta = {}) =>
      (await runMutationWithResult(action, meta)) !== null,
    [runMutationWithResult]
  );

  const clearMutationError = React.useCallback(() => {
    setMutationError(null);
  }, []);

  return {
    items: list.data?.data ?? EMPTY_ITEMS,
    isLoading: enabled && list.state === 'loading',
    error: enabled ? (manualError ?? (list.error as IamHttpError | null)) : null,
    mutationError,
    refetch,
    refetchWithOutcome,
    clearMutationError,
    setError,
    runMutationWithResult,
    runMutation,
  };
};
