import React from 'react';

import { asIamError, getMainserverMutationCapabilities, type IamHttpError } from '../lib/iam-api';
import { requestSingleFlight } from '../lib/request-singleflight';
import { useAuth } from '../providers/auth-provider';

export type UseMainserverMutationCapabilitiesResult = Readonly<{
  enabledActions: readonly string[];
  isLoading: boolean;
  error: IamHttpError | null;
}>;

export const useMainserverMutationCapabilities = (): UseMainserverMutationCapabilitiesResult => {
  const { hasResolvedSession, user } = useAuth();
  const userId = user?.id;
  const [enabledActions, setEnabledActions] = React.useState<readonly string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    if (!hasResolvedSession || !userId) {
      setEnabledActions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setEnabledActions([]);
    setIsLoading(true);
    setError(null);

    void requestSingleFlight('mainserver:mutation-capabilities', getMainserverMutationCapabilities)
      .then((response) => {
        if (active) {
          setEnabledActions(response.data.enabledActions);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(asIamError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasResolvedSession, userId]);

  return { enabledActions, isLoading, error };
};
