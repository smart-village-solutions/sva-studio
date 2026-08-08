import { summarizeContentAccess, withServerDeniedContentAccess, type IamContentAccessSummary } from '@sva/core';

import { asIamError, type IamHttpError } from '../lib/iam-api';
import { useEffectiveAccess } from '../providers/effective-access-provider';

type UseContentAccessResult = {
  readonly access: IamContentAccessSummary | null;
  readonly permissionActions: readonly string[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
};

export const useContentAccess = (): UseContentAccessResult => {
  const effectiveAccess = useEffectiveAccess();
  const { snapshot } = effectiveAccess;

  if (snapshot.status === 'error') {
    const error = asIamError({
      status: snapshot.errorCode === 'forbidden' ? 403 : 503,
      code: snapshot.errorCode,
      message: snapshot.errorCode,
    });
    return {
      access: snapshot.errorCode === 'forbidden' ? withServerDeniedContentAccess(undefined) : null,
      permissionActions: [],
      isLoading: false,
      error,
    };
  }

  if (snapshot.status !== 'ready' || snapshot.scope.kind !== 'tenant' || !('permissions' in snapshot)) {
    return {
      access: null,
      permissionActions: [],
      isLoading: snapshot.status === 'loading' || snapshot.status === 'unresolved',
      error: null,
    };
  }

  return {
    access: summarizeContentAccess(snapshot.permissions),
    permissionActions: effectiveAccess.permissionActions,
    isLoading: false,
    error: null,
  };
};
