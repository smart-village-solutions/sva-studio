import React from 'react';
import type { AuthMeResult } from '../lib/auth-me-singleflight';
import type { AuthSessionBase } from './auth-session-base';
import { useAuthSessionCommit } from './auth-session-commit';

export const useAuthLoad = (
  base: AuthSessionBase,
  handleUnauthorizedSession: (input: {
    silent: boolean;
    authFlowId: string;
    firstAttempt: number;
    result: AuthMeResult;
  }) => Promise<AuthMeResult>
) => {
  const {
    isMountedRef,
    setIsLoading,
    recordTrail,
    inFlightSilentLoadRef,
    startAuthFlow,
    nextAuthAttempt,
    fetchAuthMe,
    logAuthDebug,
  } = base;
  const {
    startLoadUserRequest,
    commitUnauthenticatedSession,
    commitAuthenticatedSession,
    commitLoadUserFailure,
  } = useAuthSessionCommit(base);
  const loadUser = React.useCallback(
    async (silent: boolean) => {
      if (silent && inFlightSilentLoadRef.current) {
        return inFlightSilentLoadRef.current;
      }

      const runLoadUser = async () => {
        const authFlowId = startAuthFlow();
        const firstAttempt = nextAuthAttempt();
        startLoadUserRequest(silent, authFlowId, firstAttempt);

        try {
          let result = await fetchAuthMe();
          logAuthDebug('auth_session_load_response', {
            silent,
            status: result.status,
            ok: result.ok,
          });
          if (result.ok) {
            recordTrail('auth_me_succeeded', {
              attempt: firstAttempt,
              authFlowId,
              result: 'succeeded',
              status: result.status,
            });
          }

          if (!result.ok && result.status === 401) {
            result = await handleUnauthorizedSession({
              authFlowId,
              firstAttempt,
              result,
              silent,
            });
          }

          if (!result.ok) {
            commitUnauthenticatedSession(silent, authFlowId, result);
            return;
          }

          commitAuthenticatedSession(silent, authFlowId, result);
        } catch (cause) {
          commitLoadUserFailure(silent, authFlowId, firstAttempt, cause);
        } finally {
          if (!silent && isMountedRef.current) {
            setIsLoading(false);
          }
        }
      };

      const loadPromise = runLoadUser();
      if (!silent) {
        return loadPromise;
      }

      inFlightSilentLoadRef.current = loadPromise;
      try {
        await loadPromise;
      } finally {
        if (inFlightSilentLoadRef.current === loadPromise) {
          inFlightSilentLoadRef.current = null;
        }
      }
    },
    [
      commitAuthenticatedSession,
      commitLoadUserFailure,
      commitUnauthenticatedSession,
      fetchAuthMe,
      handleUnauthorizedSession,
      logAuthDebug,
      nextAuthAttempt,
      recordTrail,
      startAuthFlow,
      startLoadUserRequest,
    ]
  );

  return loadUser;
};
