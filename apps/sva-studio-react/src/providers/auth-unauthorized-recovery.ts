import React from 'react';
import { hasActiveDevAuthSession } from '../lib/dev-auth';
import { readHadKnownSession } from '../lib/auth-session-state';
import type { AuthMeResult } from '../lib/auth-me-singleflight';
import {
  readAuthDiagnosticMeta,
  redirectToLogin,
  redirectToSessionExpiredNotice,
} from './auth-provider-helpers';
import type { AuthDiagnosticMeta } from './auth-provider-types';
import type { AuthSessionBase } from './auth-session-base';
import type { useSilentAuthRecovery } from './auth-silent-recovery';

export const useUnauthorizedAuthRecovery = (
  base: AuthSessionBase,
  attemptSilentSessionRecovery: ReturnType<typeof useSilentAuthRecovery>
) => {
  const {
    logAuthDebug,
    recordTrail,
    isMountedRef,
    setUser,
    setSessionExpiresAt,
    setHasResolvedSession,
    setIsLoading,
    setIsRecoveringSession,
    setSessionRecoveryFailed,
    fetchAuthMe,
    nextAuthAttempt,
  } = base;
  const handleUnauthorizedSession = React.useCallback(
    async (input: {
      silent: boolean;
      authFlowId: string;
      firstAttempt: number;
      result: AuthMeResult;
    }): Promise<AuthMeResult> => {
      const { authFlowId, firstAttempt, silent } = input;
      const devAuthSessionActive = hasActiveDevAuthSession();
      const hadKnownSession = readHadKnownSession();
      const responseMeta = readAuthDiagnosticMeta(input.result.error);
      recordTrail('auth_me_401_received', {
        attempt: firstAttempt,
        authFlowId,
        ...responseMeta,
        recoveryStep: 'initial_auth_me',
        result: 'failed',
      });

      if (!silent && isMountedRef.current) {
        setUser(null);
        setSessionExpiresAt(null);
        setHasResolvedSession(true);
        setIsLoading(false);
      }

      if (isMountedRef.current) {
        setIsRecoveringSession(true);
      }

      const recovered = devAuthSessionActive
        ? false
        : await attemptSilentSessionRecovery({
            attempt: firstAttempt,
            authFlowId,
          });
      logAuthDebug('auth_silent_recovery_result', { recovered });

      if (isMountedRef.current) {
        setIsRecoveringSession(false);
      }

      if (!recovered && hadKnownSession && !silent && isMountedRef.current) {
        setSessionRecoveryFailed(true);
        const redirectMeta = {
          attempt: firstAttempt,
          authFlowId,
          ...responseMeta,
          reasonCode: responseMeta.reasonCode ?? 'silent_recovery_failed',
          recoveryStep: 'session_expired_redirect',
          result: 'failed',
        } satisfies AuthDiagnosticMeta;
        if (responseMeta.reasonCode === 'missing_session_cookie') {
          redirectToLogin(redirectMeta);
        } else {
          redirectToSessionExpiredNotice(redirectMeta);
        }
      }

      if (!recovered) {
        return input.result;
      }

      const recoveryAttempt = nextAuthAttempt();
      const recoveryResult = await fetchAuthMe();
      logAuthDebug('auth_session_load_response_after_recovery', {
        status: recoveryResult.status,
        ok: recoveryResult.ok,
      });
      recordTrail(recoveryResult.ok ? 'auth_me_retry_succeeded' : 'auth_me_retry_failed', {
        attempt: recoveryAttempt,
        authFlowId,
        ...readAuthDiagnosticMeta(recoveryResult.error),
        recoveryStep: 'post_silent_recovery_auth_me',
        result: recoveryResult.ok ? 'succeeded' : 'failed',
        status: recoveryResult.status,
      });

      if (
        !recoveryResult.ok &&
        recoveryResult.status === 401 &&
        hadKnownSession &&
        !silent &&
        isMountedRef.current
      ) {
        const retryResponseMeta = readAuthDiagnosticMeta(recoveryResult.error);
        setSessionRecoveryFailed(true);
        const redirectMeta = {
          attempt: recoveryAttempt,
          authFlowId,
          ...retryResponseMeta,
          reasonCode: retryResponseMeta.reasonCode ?? 'session_expired',
          recoveryStep: 'session_expired_redirect',
          result: 'failed',
        } satisfies AuthDiagnosticMeta;
        if (retryResponseMeta.reasonCode === 'missing_session_cookie') {
          redirectToLogin(redirectMeta);
        } else {
          redirectToSessionExpiredNotice(redirectMeta);
        }
      }

      return recoveryResult;
    },
    [attemptSilentSessionRecovery, fetchAuthMe, logAuthDebug, nextAuthAttempt, recordTrail]
  );

  return handleUnauthorizedSession;
};
