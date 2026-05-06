import React from 'react';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { createLoginHref, createSessionExpiredHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { fetchWithRequestTimeout } from '../lib/iam-api';
import { fetchAuthMeSingleFlight } from '../lib/auth-me-singleflight';

type SessionUser = {
  id: string;
  instanceId?: string;
  assignedModules?: string[];
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
};

type AuthContextValue = AuthState & {
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
  invalidatePermissions: () => Promise<void>;
};

type AuthProviderProps = Readonly<{
  children: React.ReactNode;
}>;

type AuthMeResponse = {
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
const AUTH_DEBUG_ENABLED = !isProductionMode;
const authLogger = createOperationLogger('auth-provider', AUTH_DEBUG_ENABLED ? 'debug' : 'info');

const AuthContext = React.createContext<AuthContextValue | null>(null);

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

const redirectToSessionExpiredNotice = (): void => {
  const currentWindow = globalThis.window;
  if (!currentWindow || currentWindow.location.pathname === '/') {
    return;
  }

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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [hasResolvedSession, setHasResolvedSession] = React.useState(false);
  const [isRecoveringSession, setIsRecoveringSession] = React.useState(false);
  const [sessionRecoveryFailed, setSessionRecoveryFailed] = React.useState(false);

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const logAuthDebug = React.useCallback((message: string, details: Record<string, unknown> = {}) => {
    if (!AUTH_DEBUG_ENABLED) {
      return;
    }

    authLogger.debug(message, details);
  }, []);

  const attemptSilentSessionRecovery = React.useCallback(async (): Promise<boolean> => {
    const currentWindow = globalThis.window;
    const currentDocument = globalThis.document;

    if (!currentWindow || !currentDocument) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      logBrowserOperationStart(authLogger, 'auth_silent_recovery_started', {
        operation: 'silent_session_recovery',
        pathname: currentWindow.location.pathname,
      });
      const iframe = currentDocument.createElement('iframe');
      iframe.hidden = true;
      iframe.setAttribute('title', 'silent-auth-recovery');

      let settled = false;
      const cleanup = (result: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        currentWindow.removeEventListener('message', handleMessage);
        currentWindow.clearTimeout(timeoutId);
        iframe.remove();
        authLogger.info(result ? 'auth_silent_recovery_succeeded' : 'auth_silent_recovery_failed', {
          operation: 'silent_session_recovery',
          result: result ? 'succeeded' : 'failed',
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

        cleanup(payload.status === 'success');
      };

      const timeoutId = currentWindow.setTimeout(() => {
        authLogger.warn('auth_silent_recovery_timed_out', {
          operation: 'silent_session_recovery',
          timeout_ms: SILENT_SSO_TIMEOUT_MS,
        });
        cleanup(false);
      }, SILENT_SSO_TIMEOUT_MS);
      currentWindow.addEventListener('message', handleMessage);
      if (!isTestRuntime()) {
        iframe.src = `${createLoginHref()}&silent=1`;
      }
      currentDocument.body.appendChild(iframe);
    });
  }, []);

  const loadUser = React.useCallback(async (silent: boolean) => {
    if (!silent && isMountedRef.current) {
      setIsLoading(true);
    }

    if (isMountedRef.current) {
      setError(null);
    }

    try {
      logBrowserOperationStart(authLogger, 'auth_session_load_started', {
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
        pathname: globalThis.location?.pathname ?? null,
      });
      let result = await fetchAuthMeSingleFlight(() =>
        fetchWithRequestTimeout(AUTH_ME_ENDPOINT, undefined, { timeoutMs: 5_000 })
      );
      logAuthDebug('auth_session_load_response', {
        silent,
        status: result.status,
        ok: result.ok,
      });

      if (!result.ok && result.status === 401) {
        const hadKnownSession = readHadKnownSession();

        if (!silent && isMountedRef.current) {
          setUser(null);
          setHasResolvedSession(true);
          setIsLoading(false);
        }

        if (isMountedRef.current) {
          setIsRecoveringSession(true);
        }

        const recovered = await attemptSilentSessionRecovery();
        logAuthDebug('auth_silent_recovery_result', { recovered });

        if (isMountedRef.current) {
          setIsRecoveringSession(false);
        }

        if (!recovered && hadKnownSession && !silent && isMountedRef.current) {
          setSessionRecoveryFailed(true);
          redirectToSessionExpiredNotice();
        }

        if (recovered) {
          result = await fetchAuthMeSingleFlight(() =>
            fetchWithRequestTimeout(AUTH_ME_ENDPOINT, undefined, { timeoutMs: 5_000 })
          );
          logAuthDebug('auth_session_load_response_after_recovery', {
            status: result.status,
            ok: result.ok,
          });
        }
      }

      if (!result.ok) {
        if (isMountedRef.current) {
          setUser(null);
          setHasResolvedSession(true);
        }
        authLogger.info('auth_session_unauthenticated', {
          operation: silent ? 'invalidate_permissions' : 'load_session',
          silent,
          status: result.status,
        });
        return;
      }

      const payload = parseAuthUser(result.payload);
      if (isMountedRef.current) {
        setUser(payload);
        setHasResolvedSession(true);
        setSessionRecoveryFailed(false);
      }
      if (payload) {
        markKnownSession();
      }
      logBrowserOperationSuccess(authLogger, 'auth_session_authenticated', {
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
        has_user: Boolean(payload),
        roles_count: payload?.roles.length ?? 0,
        instance_id: payload?.instanceId,
      });
    } catch (cause) {
      if (isMountedRef.current) {
        setUser(null);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
      }
      logBrowserOperationFailure(authLogger, 'auth_session_load_failed', cause, {
        operation: silent ? 'invalidate_permissions' : 'load_session',
        silent,
      });
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [attemptSilentSessionRecovery, logAuthDebug]);

  React.useEffect(() => {
    void loadUser(false);
  }, [loadUser]);

  const refetch = React.useCallback(async () => {
    await loadUser(false);
  }, [loadUser]);

  const invalidatePermissions = React.useCallback(async () => {
    await loadUser(true);
  }, [loadUser]);

  const logout = React.useCallback(async () => {
    logBrowserOperationStart(authLogger, 'auth_logout_started', {
      operation: 'logout',
    });
    try {
      await fetchWithRequestTimeout(AUTH_LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          [LOGOUT_INTENT_HEADER]: LOGOUT_INTENT_VALUE,
        },
      }, {
        timeoutMs: 5_000,
      });
      logBrowserOperationSuccess(authLogger, 'auth_logout_completed', {
        operation: 'logout',
      });
    } catch (cause) {
      logBrowserOperationFailure(authLogger, 'auth_logout_failed', cause, {
        operation: 'logout',
      });
      throw cause;
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setError(null);
        setIsLoading(false);
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
        setSessionRecoveryFailed(false);
      }
      clearKnownSession();
    }
  }, []);

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
      refetch,
      logout,
      invalidatePermissions,
    }),
    [
      error,
      hasResolvedSession,
      invalidatePermissions,
      isLoading,
      isRecoveringSession,
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
