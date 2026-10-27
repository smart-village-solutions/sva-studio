import React from 'react';
import { logBrowserOperationStart } from '../lib/browser-operation-logging';
import { hasActiveDevAuthSession } from '../lib/dev-auth';
import {
  authLogger,
  MODULE_ACCESS_REVALIDATION_INTERVAL_MS,
  PRE_EXPIRY_REAUTH_LEAD_MS,
  computePreExpiryRetryDelayMs,
} from './auth-provider-helpers';
import type { AuthSessionBase } from './auth-session-base';
import type { useSilentAuthRecovery } from './auth-silent-recovery';
import { requestEffectiveAccessInvalidation } from './effective-access-invalidation';

export const useAuthSessionEffects = (
  base: AuthSessionBase,
  loadUser: (silent: boolean) => Promise<boolean>,
  attemptSilentSessionRecovery: ReturnType<typeof useSilentAuthRecovery>
) => {
  const {
    confirmedUserRef,
    user,
    clearSessionExpiryTimer,
    sessionExpiresAt,
    preExpiryRecoveryAttemptsRef,
    sessionExpiryTimeoutRef,
    authFlowIdRef,
    authAttemptRef,
    recordTrail,
  } = base;
  const refreshSessionAndAccess = React.useCallback(async () => {
    const refreshed = await loadUser(true);
    if (refreshed) requestEffectiveAccessInvalidation();
  }, [loadUser]);

  React.useEffect(() => {
    const currentDocument = globalThis.document;
    if (!currentDocument) {
      return;
    }

    const handleVisibilityChange = () => {
      if (currentDocument.visibilityState !== 'visible' || !confirmedUserRef.current) {
        return;
      }

      requestEffectiveAccessInvalidation();
      void refreshSessionAndAccess();
    };

    currentDocument.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      currentDocument.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSessionAndAccess]);

  React.useEffect(() => {
    const currentWindow = globalThis.window;
    if (!currentWindow || !user?.moduleAccessPending) {
      return;
    }

    const intervalId = currentWindow.setInterval(() => {
      requestEffectiveAccessInvalidation();
      void refreshSessionAndAccess();
    }, MODULE_ACCESS_REVALIDATION_INTERVAL_MS);

    return () => {
      currentWindow.clearInterval(intervalId);
    };
  }, [refreshSessionAndAccess, user?.moduleAccessPending]);

  React.useEffect(() => {
    clearSessionExpiryTimer();

    if (!user || sessionExpiresAt === null || typeof globalThis.window === 'undefined') {
      return;
    }

    const msUntilExpiry = sessionExpiresAt - Date.now();
    const attemptCount =
      preExpiryRecoveryAttemptsRef.current.expiresAt === sessionExpiresAt
        ? preExpiryRecoveryAttemptsRef.current.count
        : 0;
    const checkExpiredSession = () => {
      if (!confirmedUserRef.current) return;
      // The third state marks the final check so a stale expiry cannot schedule it again.
      preExpiryRecoveryAttemptsRef.current = { expiresAt: sessionExpiresAt, count: 3 };
      void loadUser(false);
    };
    if (msUntilExpiry <= 0) {
      if (attemptCount < 3) checkExpiredSession();
      return;
    }
    if (attemptCount >= 2) {
      sessionExpiryTimeoutRef.current = globalThis.window.setTimeout(
        checkExpiredSession,
        msUntilExpiry
      );
      return () => clearSessionExpiryTimer();
    }
    const delayMs =
      msUntilExpiry <= PRE_EXPIRY_REAUTH_LEAD_MS
        ? attemptCount > 0
          ? computePreExpiryRetryDelayMs(msUntilExpiry)
          : 0
        : msUntilExpiry - PRE_EXPIRY_REAUTH_LEAD_MS;

    sessionExpiryTimeoutRef.current = globalThis.window.setTimeout(() => {
      if (!confirmedUserRef.current) return;
      preExpiryRecoveryAttemptsRef.current = {
        expiresAt: sessionExpiresAt,
        count: attemptCount + 1,
      };
      logBrowserOperationStart(authLogger, 'auth_pre_expiry_recovery_started', {
        auth_flow_id: authFlowIdRef.current,
        attempt: authAttemptRef.current,
        operation: 'pre_expiry_session_recovery',
        expires_at: sessionExpiresAt,
        lead_ms: PRE_EXPIRY_REAUTH_LEAD_MS,
        delay_ms: delayMs,
      });
      recordTrail('auth_pre_expiry_recovery_started', {
        recoveryStep: 'pre_expiry_silent_sso',
        result: 'started',
        safeDetails: {
          auth_flow_id: authFlowIdRef.current,
          recovery_step: 'pre_expiry_silent_sso',
        },
      });
      void (async () => {
        try {
          if (!hasActiveDevAuthSession()) {
            await attemptSilentSessionRecovery({
              authFlowId: authFlowIdRef.current,
              attempt: authAttemptRef.current,
            });
          }
        } catch {
          authLogger.warn('auth_pre_expiry_silent_recovery_failed');
        }
        if (confirmedUserRef.current) {
          requestEffectiveAccessInvalidation();
          await refreshSessionAndAccess();
        }
      })();
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
  }, [
    attemptSilentSessionRecovery,
    clearSessionExpiryTimer,
    loadUser,
    recordTrail,
    refreshSessionAndAccess,
    sessionExpiresAt,
    user,
  ]);

  React.useEffect(() => {
    void loadUser(false);
  }, [loadUser]);
};
