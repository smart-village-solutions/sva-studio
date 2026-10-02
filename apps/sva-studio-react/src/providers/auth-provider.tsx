import React from 'react';
import type { AuthContextValue } from './auth-provider-types';
import { useAuthSession } from './use-auth-session';

const AuthContext = React.createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const value = useAuthSession();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
