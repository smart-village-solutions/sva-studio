import React from 'react';
import { createLoginHref } from '../lib/auth-navigation';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

type AuthState = {
  readonly user: SessionUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasResolvedSession: boolean;
  readonly isRecoveringSession: boolean;
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
const SILENT_SSO_MESSAGE_TYPE = 'sva-auth:silent-sso';
const SILENT_SSO_TIMEOUT_MS = process.env.NODE_ENV === 'test' ? 25 : 8_000;

const AuthContext = React.createContext<AuthContextValue | null>(null);

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

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const attemptSilentSessionRecovery = React.useCallback(async (): Promise<boolean> => {
    const currentWindow = globalThis.window;
    const currentDocument = globalThis.document;

    if (!currentWindow || !currentDocument) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
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
        resolve(result);
      };

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== currentWindow.location.origin) {
          return;
        }

        if (!event.data || typeof event.data !== 'object') {
          return;
        }

        const payload = event.data as { type?: unknown; status?: unknown };
        if (payload.type !== SILENT_SSO_MESSAGE_TYPE) {
          return;
        }

        cleanup(payload.status === 'success');
      };

      const timeoutId = currentWindow.setTimeout(() => cleanup(false), SILENT_SSO_TIMEOUT_MS);
      currentWindow.addEventListener('message', handleMessage);
      if (process.env.NODE_ENV !== 'test') {
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
      let response = await fetch(AUTH_ME_ENDPOINT, { credentials: 'include' });

      if (!response.ok && response.status === 401) {
        if (isMountedRef.current) {
          setIsRecoveringSession(true);
        }

        const recovered = await attemptSilentSessionRecovery();

        if (isMountedRef.current) {
          setIsRecoveringSession(false);
        }

        if (recovered) {
          response = await fetch(AUTH_ME_ENDPOINT, { credentials: 'include' });
        }
      }

      if (!response.ok) {
        if (isMountedRef.current) {
          setUser(null);
          setHasResolvedSession(true);
        }
        return;
      }

      const payload = parseAuthUser(await response.json());
      if (isMountedRef.current) {
        setUser(payload);
        setHasResolvedSession(true);
      }
    } catch (cause) {
      if (isMountedRef.current) {
        setUser(null);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

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
    try {
      await fetch(AUTH_LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setError(null);
        setIsLoading(false);
        setHasResolvedSession(true);
        setIsRecoveringSession(false);
      }
    }
  }, [attemptSilentSessionRecovery]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      hasResolvedSession,
      isRecoveringSession,
      refetch,
      logout,
      invalidatePermissions,
    }),
    [error, hasResolvedSession, invalidatePermissions, isLoading, isRecoveringSession, logout, refetch, user]
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
