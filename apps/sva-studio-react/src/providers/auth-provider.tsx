import React from 'react';

type SessionUser = {
  id: string;
  name: string;
  email?: string;
  instanceId?: string;
  roles: string[];
};

type AuthState = {
  readonly user: SessionUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
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

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadUser = React.useCallback(async (silent: boolean) => {
    if (!silent && isMountedRef.current) {
      setIsLoading(true);
    }

    if (isMountedRef.current) {
      setError(null);
    }

    try {
      const response = await fetch(AUTH_ME_ENDPOINT, { credentials: 'include' });

      if (!response.ok) {
        if (isMountedRef.current) {
          setUser(null);
        }
        return;
      }

      const payload = parseAuthUser(await response.json());
      if (isMountedRef.current) {
        setUser(payload);
      }
    } catch (cause) {
      if (isMountedRef.current) {
        setUser(null);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
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
      }
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      refetch,
      logout,
      invalidatePermissions,
    }),
    [error, invalidatePermissions, isLoading, logout, refetch, user]
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
