import React from 'react';

import { asIamError, type IamHttpError } from '../lib/iam-api';

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
  readonly runMutation: (action: () => Promise<unknown>) => Promise<boolean>;
};

export const useIamAdminList = <TItem>(
  listItems: () => Promise<ListResponse<TItem>>,
  invalidatePermissions: () => Promise<void> | void
): UseIamAdminListResult<TItem> => {
  const [items, setItems] = React.useState<readonly TItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listItems();
      setItems(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setItems([]);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, listItems]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const runMutation = React.useCallback(
    async (action: () => Promise<unknown>) => {
      setMutationError(null);
      try {
        await action();
        await refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return false;
      }
    },
    [invalidatePermissions, refetch]
  );

  return {
    items,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    setError,
    runMutation,
  };
};
