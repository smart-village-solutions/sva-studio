import React from 'react';
import {
  logBrowserOperationStart,
  logBrowserOperationFailure,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { asIamError } from '../lib/iam-api';
import { markKnownSession } from '../lib/auth-session-state';
import type { AuthMeResult } from '../lib/auth-me-singleflight';
import {
  authLogger,
  parseAuthUser,
  parseSessionExpiresAt,
  readAuthDiagnosticMeta,
} from './auth-provider-helpers';
import type { AuthSessionBase } from './auth-session-base';

export const useAuthSessionCommit = (base: AuthSessionBase) => {
  const {
    isMountedRef,
    setIsLoading,
    setError,
    recordTrail,
    authAttemptRef,
    setUser,
    setSessionExpiresAt,
    setHasResolvedSession,
    setSessionRecoveryFailed,
    warmProjectedContentsAfterSessionLoad,
    setIsRecoveringSession,
  } = base;
  const startLoadUserRequest = React.useCallback(
    (silent: boolean, authFlowId: string, firstAttempt: number) => {
      if (!silent && isMountedRef.current) {
        setIsLoading(true);
      }

      if (isMountedRef.current) {
        setError(null);
      }

      logBrowserOperationStart(authLogger, 'auth_session_load_started', {
        auth_flow_id: authFlowId,
        attempt: firstAttempt,
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
        pathname: globalThis.location?.pathname ?? null,
      });
      recordTrail('auth_session_load_started', {
        attempt: firstAttempt,
        authFlowId,
        recoveryStep: silent ? 'invalidate_permissions' : 'load_session',
        result: 'started',
      });
    },
    [recordTrail]
  );

  const commitUnauthenticatedSession = React.useCallback(
    (silent: boolean, authFlowId: string, result: AuthMeResult) => {
      const shouldClearConfirmedSnapshot =
        !silent || result.status === 401 || result.status === 403;
      if (isMountedRef.current) {
        if (shouldClearConfirmedSnapshot) {
          setUser(null);
          setSessionExpiresAt(null);
        }
        setHasResolvedSession(true);
      }
      authLogger.info('auth_session_unauthenticated', {
        auth_flow_id: authFlowId,
        attempt: authAttemptRef.current,
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
        status: result.status,
        request_id: result.error?.requestId,
        reason_code: result.error?.safeDetails?.reason_code,
      });
    },
    []
  );

  const commitAuthenticatedSession = React.useCallback(
    (silent: boolean, authFlowId: string, result: AuthMeResult) => {
      const payload = parseAuthUser(result.payload);
      const expiresAt = parseSessionExpiresAt(result.payload);
      if (isMountedRef.current) {
        setUser(payload);
        setSessionExpiresAt(expiresAt ?? null);
        setHasResolvedSession(true);
        setSessionRecoveryFailed(false);
      }
      if (payload) {
        markKnownSession();
      }
      warmProjectedContentsAfterSessionLoad(silent, payload);
      logBrowserOperationSuccess(authLogger, 'auth_session_authenticated', {
        auth_flow_id: authFlowId,
        attempt: authAttemptRef.current,
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
        has_user: Boolean(payload),
        roles_count: payload?.roles.length ?? 0,
        instance_id: payload?.instanceId,
        expires_at: expiresAt,
      });
    },
    [warmProjectedContentsAfterSessionLoad]
  );

  const commitLoadUserFailure = React.useCallback(
    (silent: boolean, authFlowId: string, firstAttempt: number, cause: unknown) => {
      const resolvedError = asIamError(cause);
      recordTrail('auth_session_load_failed', {
        attempt: authAttemptRef.current || firstAttempt,
        authFlowId,
        ...readAuthDiagnosticMeta(resolvedError),
        recoveryStep: silent ? 'invalidate_permissions' : 'load_session',
        result: 'failed',
      });
      if (isMountedRef.current) {
        if (!silent) {
          setUser(null);
          setSessionExpiresAt(null);
          setError(resolvedError);
        }
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
      }
      logBrowserOperationFailure(authLogger, 'auth_session_load_failed', resolvedError, {
        auth_flow_id: authFlowId,
        attempt: authAttemptRef.current || firstAttempt,
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
      });
    },
    [recordTrail]
  );

  return {
    startLoadUserRequest,
    commitUnauthenticatedSession,
    commitAuthenticatedSession,
    commitLoadUserFailure,
  };
};
