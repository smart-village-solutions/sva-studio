import React from 'react';

import { getThemeDisplayName, type AppThemeName, type ThemeMode, THEME_MODE_STORAGE_KEY, resolveThemeMode, resolveThemeName } from '../lib/theme';
import { useAuth } from './auth-provider';

type ThemeContextValue = {
  readonly mode: ThemeMode;
  readonly themeName: AppThemeName;
  readonly themeLabel: string;
  readonly setMode: (mode: ThemeMode) => void;
  readonly toggleMode: () => void;
};

type ThemeProviderProps = Readonly<{
  children: React.ReactNode;
}>;

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const getSystemDarkModePreference = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyThemeToDocument = (themeName: AppThemeName, mode: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = themeName;
  root.dataset.themeMode = mode;
  root.style.colorScheme = mode;
  root.classList.toggle('dark', mode === 'dark');
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { user } = useAuth();
  const themeName = React.useMemo(() => resolveThemeName(user?.instanceId), [user?.instanceId]);
  const [mode, setModeState] = React.useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const persistedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return resolveThemeMode(persistedMode, getSystemDarkModePreference());
  });

  React.useEffect(() => {
    applyThemeToDocument(themeName, mode);
  }, [mode, themeName]);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    }
  }, []);

  const toggleMode = React.useCallback(() => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  }, [mode, setMode]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      mode,
      themeName,
      themeLabel: getThemeDisplayName(themeName),
      setMode,
      toggleMode,
    }),
    [mode, setMode, themeName, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
};
