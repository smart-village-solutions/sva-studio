import React from 'react';
import {
  logBrowserOperationStart,
  logBrowserOperationSuccess,
  logBrowserOperationFailure,
} from '../lib/browser-operation-logging';
import { resolveCurrentReturnTo } from '../lib/auth-navigation';
import { clearClientLogoutState } from '../lib/auth-session-state';
import {
  hasActiveDevAuthSession,
  DEV_AUTH_LOGIN_ENDPOINT,
  DEV_AUTH_LOGOUT_ENDPOINT,
} from '../lib/dev-auth';
import { fetchWithRequestTimeout } from '../lib/iam-api';
import {
  AUTH_LOGOUT_ENDPOINT,
  LOGOUT_INTENT_HEADER,
  LOGOUT_INTENT_VALUE,
  authLogger,
} from './auth-provider-helpers';
import type { AuthSessionBase } from './auth-session-base';

export const useAuthSessionActions = (
  base: AuthSessionBase,
  loadUser: (silent: boolean) => Promise<void>
) => {
  const {
    devAuthAvailable,
    isMountedRef,
    setUser,
    setSessionExpiresAt,
    setError,
    setIsLoading,
    setHasResolvedSession,
    setIsRecoveringSession,
    setSessionRecoveryFailed,
    startAuthFlow,
    nextAuthAttempt,
    recordTrail,
  } = base;
  const refetch = React.useCallback(async () => {
    await loadUser(false);
  }, [loadUser]);

  const loginWithDevAuth = React.useCallback(async () => {
    if (!devAuthAvailable) {
      return;
    }

    await fetchWithRequestTimeout(
      `${DEV_AUTH_LOGIN_ENDPOINT}?returnTo=${encodeURIComponent(resolveCurrentReturnTo())}`,
      {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
      {
        timeoutMs: 5_000,
      }
    );
    await loadUser(false);
  }, [devAuthAvailable, loadUser]);

  const refreshSession = React.useCallback(async () => {
    await loadUser(true);
  }, [loadUser]);

  const logout = React.useCallback(async () => {
    const devAuthSessionActive = hasActiveDevAuthSession();
    const authFlowId = startAuthFlow();
    const attempt = nextAuthAttempt();
    logBrowserOperationStart(authLogger, 'auth_logout_started', {
      auth_flow_id: authFlowId,
      attempt,
      operation: 'logout',
    });
    recordTrail('auth_logout_started', {
      attempt,
      authFlowId,
      recoveryStep: 'logout',
      result: 'started',
    });
    try {
      await fetchWithRequestTimeout(
        devAuthSessionActive ? DEV_AUTH_LOGOUT_ENDPOINT : AUTH_LOGOUT_ENDPOINT,
        {
          method: 'POST',
          ...(devAuthSessionActive
            ? {}
            : {
                headers: {
                  [LOGOUT_INTENT_HEADER]: LOGOUT_INTENT_VALUE,
                },
              }),
        },
        {
          timeoutMs: 5_000,
        }
      );
      logBrowserOperationSuccess(authLogger, 'auth_logout_completed', {
        auth_flow_id: authFlowId,
        attempt,
        operation: 'logout',
      });
      recordTrail('auth_logout_completed', {
        attempt,
        authFlowId,
        recoveryStep: 'logout',
        result: 'succeeded',
      });
    } catch (cause) {
      logBrowserOperationFailure(authLogger, 'auth_logout_failed', cause, {
        auth_flow_id: authFlowId,
        attempt,
        operation: 'logout',
      });
      throw cause;
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setSessionExpiresAt(null);
        setError(null);
        setIsLoading(false);
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
        setSessionRecoveryFailed(false);
      }
      clearClientLogoutState();
    }
  }, [nextAuthAttempt, recordTrail, startAuthFlow]);

  return { refetch, loginWithDevAuth, refreshSession, logout };
};
