import React from 'react';
import {
  createAuthFlowId,
  publishAuthDiagnosticsDebugHandle,
  recordAuthDiagnosticEvent,
} from '../lib/auth-diagnostics';
import { isDevAuthAvailable } from '../lib/dev-auth';
import {
  fetchWithRequestTimeout,
  refreshProjectedContents as requestProjectedContentsRefresh,
  asIamError,
} from '../lib/iam-api';
import { fetchAuthMeSingleFlight } from '../lib/auth-me-singleflight';
import {
  AUTH_DEBUG_ENABLED,
  AUTH_ME_ENDPOINT,
  authLogger,
  resolveReadableMainserverVisibleTypes,
} from './auth-provider-helpers';
import type { AuthDiagnosticMeta, SessionUser } from './auth-provider-types';

export const useAuthSessionBase = () => {
  const devAuthAvailable = isDevAuthAvailable();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [hasResolvedSession, setHasResolvedSession] = React.useState(false);
  const [isRecoveringSession, setIsRecoveringSession] = React.useState(false);
  const [sessionRecoveryFailed, setSessionRecoveryFailed] = React.useState(false);

  const isMountedRef = React.useRef(true);
  const confirmedUserRef = React.useRef<SessionUser | null>(null);
  const authFlowIdRef = React.useRef<string>(createAuthFlowId());
  const authAttemptRef = React.useRef(0);
  const sessionExpiryTimeoutRef = React.useRef<number | null>(null);
  const lastPreExpiryRecoveryAttemptRef = React.useRef<number | null>(null);
  const inFlightSilentLoadRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;
    publishAuthDiagnosticsDebugHandle();
    return () => {
      isMountedRef.current = false;
      if (sessionExpiryTimeoutRef.current !== null) {
        globalThis.window?.clearTimeout(sessionExpiryTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    confirmedUserRef.current = user;
  }, [user]);

  const clearSessionExpiryTimer = React.useCallback(() => {
    if (sessionExpiryTimeoutRef.current !== null) {
      globalThis.window?.clearTimeout(sessionExpiryTimeoutRef.current);
      sessionExpiryTimeoutRef.current = null;
    }
  }, []);

  const logAuthDebug = React.useCallback(
    (message: string, details: Record<string, unknown> = {}) => {
      if (!AUTH_DEBUG_ENABLED) {
        return;
      }

      authLogger.debug(message, details);
    },
    []
  );

  const startAuthFlow = React.useCallback(() => {
    const authFlowId = createAuthFlowId();
    authFlowIdRef.current = authFlowId;
    authAttemptRef.current = 0;
    return authFlowId;
  }, []);

  const warmProjectedContentsAfterSessionLoad = React.useCallback(
    (silent: boolean, payload: SessionUser | null) => {
      const previousUser = confirmedUserRef.current;
      const readableVisibleTypes = resolveReadableMainserverVisibleTypes(
        payload?.permissionActions
      );
      const isNewShift =
        !silent &&
        Boolean(payload?.instanceId) &&
        readableVisibleTypes.length > 0 &&
        (!previousUser ||
          previousUser.id !== payload?.id ||
          previousUser.instanceId !== payload?.instanceId);

      if (!isNewShift) {
        return;
      }

      void requestProjectedContentsRefresh({
        visibleTypes: [...readableVisibleTypes],
      }).catch((cause) => {
        const resolvedError = asIamError(cause);
        authLogger.warn('auth_projected_content_refresh_failed', {
          auth_flow_id: authFlowIdRef.current,
          attempt: authAttemptRef.current,
          operation: 'warm_projected_contents',
          status: resolvedError.status,
          error_code: resolvedError.code,
        });
      });
    },
    []
  );

  const nextAuthAttempt = React.useCallback(() => {
    authAttemptRef.current += 1;
    return authAttemptRef.current;
  }, []);

  const recordTrail = React.useCallback(
    (
      event: string,
      meta: Partial<AuthDiagnosticMeta> & { authFlowId?: string; attempt?: number } = {}
    ) => {
      recordAuthDiagnosticEvent({
        authFlowId: meta.authFlowId ?? authFlowIdRef.current,
        attempt: meta.attempt ?? authAttemptRef.current,
        classification: meta.classification,
        diagnosticStatus: meta.diagnosticStatus,
        event,
        pathname: meta.pathname ?? globalThis.location?.pathname ?? undefined,
        reasonCode: meta.reasonCode,
        recoveryStep: meta.recoveryStep,
        requestId: meta.requestId,
        result: meta.result,
        safeDetails: meta.safeDetails,
        status: meta.status,
      });
    },
    []
  );

  const fetchAuthMe = React.useCallback(
    () =>
      fetchAuthMeSingleFlight(() =>
        fetchWithRequestTimeout(AUTH_ME_ENDPOINT, undefined, { timeoutMs: 5_000 })
      ),
    []
  );

  return {
    devAuthAvailable,
    user,
    setUser,
    sessionExpiresAt,
    setSessionExpiresAt,
    isLoading,
    setIsLoading,
    error,
    setError,
    hasResolvedSession,
    setHasResolvedSession,
    isRecoveringSession,
    setIsRecoveringSession,
    sessionRecoveryFailed,
    setSessionRecoveryFailed,
    isMountedRef,
    confirmedUserRef,
    authFlowIdRef,
    authAttemptRef,
    sessionExpiryTimeoutRef,
    lastPreExpiryRecoveryAttemptRef,
    inFlightSilentLoadRef,
    clearSessionExpiryTimer,
    logAuthDebug,
    startAuthFlow,
    warmProjectedContentsAfterSessionLoad,
    nextAuthAttempt,
    recordTrail,
    fetchAuthMe,
  };
};

export type AuthSessionBase = ReturnType<typeof useAuthSessionBase>;
