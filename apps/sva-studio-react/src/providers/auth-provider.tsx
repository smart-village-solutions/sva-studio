import React from 'react';
import type {
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeSafeDetails,
} from '@sva/core';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import {
  clearAuthDiagnosticTrail,
  createAuthFlowId,
  publishAuthDiagnosticsDebugHandle,
  recordAuthDiagnosticEvent,
} from '../lib/auth-diagnostics';
import {
  createLoginHref,
  createSessionExpiredHref,
  resolveCurrentReturnTo,
} from '../lib/auth-navigation';
import {
  hasActiveDevAuthSession,
  DEV_AUTH_LOGIN_ENDPOINT,
  DEV_AUTH_LOGOUT_ENDPOINT,
  isDevAuthAvailable,
} from '../lib/dev-auth';
import {
  asIamError,
  fetchWithRequestTimeout,
  type IamHttpError,
} from '../lib/iam-api';
import { fetchAuthMeSingleFlight } from '../lib/auth-me-singleflight';

type SessionUser = {
  id: string;
  instanceId?: string;
  assignedModules?: string[];
  permissionActions?: readonly string[];
  roles: string[];
  permissionStatus?: 'ok' | 'degraded';
};

type AuthState = {
  readonly user: SessionUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasResolvedSession: boolean;
  readonly isRecoveringSession: boolean;
  readonly sessionRecoveryFailed: boolean;
  readonly permissionsDegraded: boolean;
  readonly isDevAuthAvailable: boolean;
};

type AuthContextValue = AuthState & {
  refetch: () => Promise<void>;
  loginWithDevAuth: () => Promise<void>;
  logout: () => Promise<void>;
  invalidatePermissions: () => Promise<void>;
};

type AuthProviderProps = Readonly<{
  children: React.ReactNode;
}>;

type AuthMeResponse = {
  readonly expiresAt?: number;
  readonly user?: SessionUser;
};

const AUTH_ME_ENDPOINT = '/auth/me';
const AUTH_LOGOUT_ENDPOINT = '/auth/logout';
const LOGOUT_INTENT_HEADER = 'x-sva-logout-intent';
const LOGOUT_INTENT_VALUE = 'user';
const SILENT_SSO_MESSAGE_TYPE = 'sva-auth:silent-sso';
const AUTH_KNOWN_SESSION_STORAGE_KEY = 'sva_auth_had_session';
const isProductionMode = import.meta.env.PROD;
const isTestRuntime = () =>
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITEST === true ||
  import.meta.env.VITEST === 'true';
const SILENT_SSO_TIMEOUT_MS = isTestRuntime() ? 250 : 8_000;
const PRE_EXPIRY_REAUTH_LEAD_MS = 60_000;
const PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS = 1_000;
const AUTH_DEBUG_ENABLED = !isProductionMode;
const authLogger = createOperationLogger('auth-provider', AUTH_DEBUG_ENABLED ? 'debug' : 'info');

const AuthContext = React.createContext<AuthContextValue | null>(null);

type AuthDiagnosticMeta = Readonly<{
  authFlowId: string;
  attempt: number;
  classification?: IamRuntimeDiagnosticClassification;
  diagnosticStatus?: IamRuntimeDiagnosticStatus;
  pathname?: string;
  reasonCode?: string;
  recoveryStep?: string;
  requestId?: string;
  result?: string;
  safeDetails?: IamRuntimeSafeDetails;
  status?: number;
}>;

const readHadKnownSession = (): boolean => {
  try {
    return globalThis.window?.localStorage.getItem(AUTH_KNOWN_SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const markKnownSession = (): void => {
  try {
    globalThis.window?.localStorage.setItem(AUTH_KNOWN_SESSION_STORAGE_KEY, '1');
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const clearKnownSession = (): void => {
  try {
    globalThis.window?.localStorage.removeItem(AUTH_KNOWN_SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const readAuthDiagnosticMeta = (error: IamHttpError | undefined): Partial<AuthDiagnosticMeta> => ({
  classification: error?.classification,
  diagnosticStatus: error?.diagnosticStatus,
  reasonCode: error?.safeDetails?.reason_code,
  requestId: error?.requestId,
  safeDetails: error?.safeDetails,
  status: error?.status,
});

const redirectToSessionExpiredNotice = (meta: AuthDiagnosticMeta): void => {
  const currentWindow = globalThis.window;
  if (!currentWindow || currentWindow.location.pathname === '/') {
    return;
  }

  recordAuthDiagnosticEvent({
    authFlowId: meta.authFlowId,
    attempt: meta.attempt,
    classification: meta.classification,
    diagnosticStatus: meta.diagnosticStatus,
    event: 'auth_redirect_session_expired',
    pathname: currentWindow.location.pathname,
    reasonCode: meta.reasonCode,
    recoveryStep: meta.recoveryStep ?? 'redirect_session_expired',
    requestId: meta.requestId,
    result: 'failed',
    safeDetails: meta.safeDetails,
    status: meta.status,
  });
  currentWindow.location.assign(createSessionExpiredHref(resolveCurrentReturnTo()));
};

const parseAuthUser = (payload: unknown): SessionUser | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as AuthMeResponse;
  if (!candidate.user || typeof candidate.user !== 'object') {
    return null;
  }

  return candidate.user;
};

const parseSessionExpiresAt = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as AuthMeResponse;
  return typeof candidate.expiresAt === 'number' && Number.isFinite(candidate.expiresAt)
    ? candidate.expiresAt
    : undefined;
};

const computePreExpiryRetryDelayMs = (msUntilExpiry: number): number => {
  if (msUntilExpiry <= PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS) {
    return Math.max(1, Math.floor(msUntilExpiry / 2));
  }

  return msUntilExpiry - PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
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

  const attemptSilentSessionRecovery = React.useCallback(
    async (input: { authFlowId: string; attempt: number }): Promise<boolean> => {
      const currentWindow = globalThis.window;
      const currentDocument = globalThis.document;

      if (!currentWindow || !currentDocument) {
        return false;
      }

      return new Promise<boolean>((resolve) => {
        logBrowserOperationStart(authLogger, 'auth_silent_recovery_started', {
          auth_flow_id: input.authFlowId,
          attempt: input.attempt,
          operation: 'silent_session_recovery',
          pathname: currentWindow.location.pathname,
        });
        recordTrail('auth_silent_recovery_started', {
          ...input,
          recoveryStep: 'iframe_started',
          result: 'started',
        });
        const iframe = currentDocument.createElement('iframe');
        iframe.hidden = true;
        iframe.setAttribute('title', 'silent-auth-recovery');

        let settled = false;
        const cleanup = (
          result: boolean,
          reasonCode:
            | 'silent_recovery_failed'
            | 'silent_recovery_succeeded'
            | 'silent_recovery_timeout'
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          currentWindow.removeEventListener('message', handleMessage);
          currentWindow.clearTimeout(timeoutId);
          iframe.remove();
          authLogger.info(
            result ? 'auth_silent_recovery_succeeded' : 'auth_silent_recovery_failed',
            {
              auth_flow_id: input.authFlowId,
              attempt: input.attempt,
              operation: 'silent_session_recovery',
              result: result ? 'succeeded' : 'failed',
            }
          );
          recordTrail(result ? 'auth_silent_recovery_succeeded' : 'auth_silent_recovery_failed', {
            ...input,
            classification: result
              ? 'frontend_state_or_permission_staleness'
              : 'oidc_discovery_or_exchange',
            diagnosticStatus: result ? 'degradiert' : 'recovery_laeuft',
            reasonCode,
            recoveryStep: result ? 'iframe_success' : 'iframe_failed',
            result: result ? 'succeeded' : 'failed',
            safeDetails: {
              auth_flow_id: input.authFlowId,
              reason_code: reasonCode,
              recovery_step: result ? 'iframe_success' : 'iframe_failed',
            },
          });
          resolve(result);
        };

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== currentWindow.location.origin) {
            logAuthDebug('auth_silent_recovery_ignored_origin', { origin: event.origin });
            return;
          }

          if (!event.data || typeof event.data !== 'object') {
            logAuthDebug('auth_silent_recovery_invalid_payload', { reason: 'non_object_payload' });
            return;
          }

          const payload = event.data as { type?: unknown; status?: unknown };
          if (payload.type !== SILENT_SSO_MESSAGE_TYPE) {
            logAuthDebug('auth_silent_recovery_invalid_payload', { reason: 'unexpected_type' });
            return;
          }

          recordTrail('auth_silent_recovery_message_received', {
            ...input,
            recoveryStep: 'iframe_message',
            result: String(payload.status),
          });
          cleanup(
            payload.status === 'success',
            payload.status === 'success' ? 'silent_recovery_succeeded' : 'silent_recovery_failed'
          );
        };

        const timeoutId = currentWindow.setTimeout(() => {
          authLogger.warn('auth_silent_recovery_timed_out', {
            auth_flow_id: input.authFlowId,
            attempt: input.attempt,
            operation: 'silent_session_recovery',
            timeout_ms: SILENT_SSO_TIMEOUT_MS,
          });
          cleanup(false, 'silent_recovery_timeout');
        }, SILENT_SSO_TIMEOUT_MS);
        currentWindow.addEventListener('message', handleMessage);
        if (!isTestRuntime()) {
          iframe.src = `${createLoginHref()}&silent=1`;
        }
        currentDocument.body.appendChild(iframe);
      });
    },
    [logAuthDebug, recordTrail]
  );

  const loadUser = React.useCallback(
    async (silent: boolean) => {
      if (silent && inFlightSilentLoadRef.current) {
        return inFlightSilentLoadRef.current;
      }

      const runLoadUser = async () => {
      const authFlowId = startAuthFlow();
      const firstAttempt = nextAuthAttempt();
      if (!silent && isMountedRef.current) {
        setIsLoading(true);
      }

      if (isMountedRef.current) {
        setError(null);
      }

      try {
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
        let result = await fetchAuthMeSingleFlight(() =>
          fetchWithRequestTimeout(AUTH_ME_ENDPOINT, undefined, { timeoutMs: 5_000 })
        );
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
          const devAuthSessionActive = hasActiveDevAuthSession();
          const hadKnownSession = readHadKnownSession();
          const responseMeta = readAuthDiagnosticMeta(result.error);
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
            redirectToSessionExpiredNotice({
              attempt: firstAttempt,
              authFlowId,
              ...responseMeta,
              reasonCode: responseMeta.reasonCode ?? 'silent_recovery_failed',
              recoveryStep: 'session_expired_redirect',
              result: 'failed',
            });
          }

          if (recovered) {
            const recoveryAttempt = nextAuthAttempt();
            result = await fetchAuthMeSingleFlight(() =>
              fetchWithRequestTimeout(AUTH_ME_ENDPOINT, undefined, { timeoutMs: 5_000 })
            );
            logAuthDebug('auth_session_load_response_after_recovery', {
              status: result.status,
              ok: result.ok,
            });
            recordTrail(result.ok ? 'auth_me_retry_succeeded' : 'auth_me_retry_failed', {
              attempt: recoveryAttempt,
              authFlowId,
              ...readAuthDiagnosticMeta(result.error),
              recoveryStep: 'post_silent_recovery_auth_me',
              result: result.ok ? 'succeeded' : 'failed',
              status: result.status,
            });

            if (!result.ok && result.status === 401 && hadKnownSession && !silent && isMountedRef.current) {
              const retryResponseMeta = readAuthDiagnosticMeta(result.error);
              setSessionRecoveryFailed(true);
              redirectToSessionExpiredNotice({
                attempt: recoveryAttempt,
                authFlowId,
                ...retryResponseMeta,
                reasonCode: retryResponseMeta.reasonCode ?? 'session_expired',
                recoveryStep: 'session_expired_redirect',
                result: 'failed',
              });
            }
          }
        }

        if (!result.ok) {
          const shouldClearConfirmedSnapshot = !silent || result.status === 401 || result.status === 403;
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
          return;
        }

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
      } catch (cause) {
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
    [attemptSilentSessionRecovery, logAuthDebug, nextAuthAttempt, recordTrail, startAuthFlow]
  );

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
  }, [
    clearSessionExpiryTimer,
    loadUser,
    recordTrail,
    sessionExpiresAt,
    user,
  ]);

  React.useEffect(() => {
    void loadUser(false);
  }, [loadUser]);

  React.useEffect(() => {
    publishSessionAccessSnapshot({
      isResolved: hasResolvedSession,
      permissionActions: user?.permissionActions ?? [],
    });
  }, [hasResolvedSession, user]);

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

  const invalidatePermissions = React.useCallback(async () => {
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
      clearKnownSession();
      clearAuthDiagnosticTrail();
    }
  }, [nextAuthAttempt, recordTrail, startAuthFlow]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      hasResolvedSession,
      isRecoveringSession,
      sessionRecoveryFailed,
      permissionsDegraded: user?.permissionStatus === 'degraded',
      isDevAuthAvailable: devAuthAvailable,
      refetch,
      loginWithDevAuth,
      logout,
      invalidatePermissions,
    }),
    [
      error,
      devAuthAvailable,
      hasResolvedSession,
      invalidatePermissions,
      isLoading,
      isRecoveringSession,
      loginWithDevAuth,
      logout,
      refetch,
      sessionRecoveryFailed,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
