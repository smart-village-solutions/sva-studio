import React from 'react';
import { useAuthSessionBase } from './auth-session-base';
import { useSilentAuthRecovery } from './auth-silent-recovery';
import { useUnauthorizedAuthRecovery } from './auth-unauthorized-recovery';
import { useAuthLoad } from './auth-session-load';
import { useAuthSessionEffects } from './auth-session-effects';
import { useAuthSessionActions } from './auth-session-actions';
import type { AuthContextValue } from './auth-provider-types';

export const useAuthSession = (): AuthContextValue => {
  const base = useAuthSessionBase();
  const attemptSilentSessionRecovery = useSilentAuthRecovery(base);
  const handleUnauthorizedSession = useUnauthorizedAuthRecovery(base, attemptSilentSessionRecovery);
  const loadUser = useAuthLoad(base, handleUnauthorizedSession);
  useAuthSessionEffects(base, loadUser);
  const { refetch, loginWithDevAuth, refreshSession, logout } = useAuthSessionActions(
    base,
    loadUser
  );
  const {
    user,
    isLoading,
    error,
    hasResolvedSession,
    isRecoveringSession,
    sessionRecoveryFailed,
    devAuthAvailable,
  } = base;
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
      refreshSession,
    }),
    [
      error,
      devAuthAvailable,
      hasResolvedSession,
      refreshSession,
      isLoading,
      isRecoveringSession,
      loginWithDevAuth,
      logout,
      refetch,
      sessionRecoveryFailed,
      user,
    ]
  );

  return value;
};
