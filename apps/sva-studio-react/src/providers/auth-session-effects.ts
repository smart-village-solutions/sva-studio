import React from 'react';
import { logBrowserOperationStart } from '../lib/browser-operation-logging';
import {
  authLogger,
  MODULE_ACCESS_REVALIDATION_INTERVAL_MS,
  PRE_EXPIRY_REAUTH_LEAD_MS,
  computePreExpiryRetryDelayMs,
} from './auth-provider-helpers';
import type { AuthSessionBase } from './auth-session-base';

export const useAuthSessionEffects = (
  base: AuthSessionBase,
  loadUser: (silent: boolean) => Promise<void>
) => {
  const {
    confirmedUserRef,
    user,
    clearSessionExpiryTimer,
    sessionExpiresAt,
    lastPreExpiryRecoveryAttemptRef,
    sessionExpiryTimeoutRef,
    authFlowIdRef,
    authAttemptRef,
    recordTrail,
  } = base;
  React.useEffect(() => {
    const currentDocument = globalThis.document;
    if (!currentDocument) {
      return;
    }

    const handleVisibilityChange = () => {
      if (currentDocument.visibilityState !== 'visible' || !confirmedUserRef.current) {
        return;
      }

      void loadUser(true);
    };

    currentDocument.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      currentDocument.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadUser]);

  React.useEffect(() => {
    const currentWindow = globalThis.window;
    if (!currentWindow || !user?.moduleAccessPending) {
      return;
    }

    const intervalId = currentWindow.setInterval(() => {
      void loadUser(true);
    }, MODULE_ACCESS_REVALIDATION_INTERVAL_MS);

    return () => {
      currentWindow.clearInterval(intervalId);
    };
  }, [loadUser, user?.moduleAccessPending]);

  React.useEffect(() => {
    clearSessionExpiryTimer();

    if (!user || sessionExpiresAt === null || typeof globalThis.window === 'undefined') {
      return;
    }

    const msUntilExpiry = sessionExpiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      return;
    }

    const hasAlreadyAttemptedCurrentExpiry =
      lastPreExpiryRecoveryAttemptRef.current === sessionExpiresAt;
    const delayMs =
      msUntilExpiry <= PRE_EXPIRY_REAUTH_LEAD_MS
        ? hasAlreadyAttemptedCurrentExpiry
          ? computePreExpiryRetryDelayMs(msUntilExpiry)
          : 0
        : msUntilExpiry - PRE_EXPIRY_REAUTH_LEAD_MS;

    sessionExpiryTimeoutRef.current = globalThis.window.setTimeout(() => {
      lastPreExpiryRecoveryAttemptRef.current = sessionExpiresAt;
      logBrowserOperationStart(authLogger, 'auth_pre_expiry_recovery_started', {
        auth_flow_id: authFlowIdRef.current,
        attempt: authAttemptRef.current,
        operation: 'pre_expiry_session_recovery',
        expires_at: sessionExpiresAt,
        lead_ms: PRE_EXPIRY_REAUTH_LEAD_MS,
        delay_ms: delayMs,
      });
      recordTrail('auth_pre_expiry_recovery_started', {
        recoveryStep: 'pre_expiry_auth_me',
        result: 'started',
        safeDetails: {
          auth_flow_id: authFlowIdRef.current,
          recovery_step: 'pre_expiry_auth_me',
        },
      });
      void loadUser(true);
    }, delayMs);

    recordTrail('auth_pre_expiry_recovery_scheduled', {
      recoveryStep: 'pre_expiry_timer_scheduled',
      result: 'scheduled',
      safeDetails: {
        auth_flow_id: authFlowIdRef.current,
        recovery_step: 'pre_expiry_timer_scheduled',
      },
    });

    return () => {
      clearSessionExpiryTimer();
    };
  }, [clearSessionExpiryTimer, loadUser, recordTrail, sessionExpiresAt, user]);

  React.useEffect(() => {
    void loadUser(false);
  }, [loadUser]);
};
